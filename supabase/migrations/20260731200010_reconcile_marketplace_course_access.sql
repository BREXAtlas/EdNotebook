-- Preserve a learner's strongest remaining marketplace access when one order
-- is refunded or lost to a chargeback. Course membership is a projection of
-- active entitlements, so revoking one overlapping order must reconcile that
-- projection instead of deleting it unconditionally.

create or replace function public.marketplace_revoke_order_entitlement(
  p_order_id uuid,
  p_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_order public.marketplace_orders%rowtype;
  v_fallback_order_id uuid;
  v_fallback_expiry timestamptz;
begin
  select * into v_order
  from public.marketplace_orders
  where id=p_order_id
  for update;
  if not found then raise exception 'Marketplace order not found'; end if;
  if p_status not in ('refunded','disputed','chargeback') then
    raise exception 'Choose a governed revocation status';
  end if;

  update public.marketplace_entitlements
  set status=case when p_status='refunded' then 'refunded' else 'disputed' end,
      revoked_at=now(),
      revocation_reason=left(coalesce(p_reason,p_status),500),
      updated_at=now()
  where order_id=v_order.id;

  if v_order.item_kind='book' then
    update public.publication_entitlements
    set active=false,
        expires_at=least(coalesce(expires_at,now()),now()),
        updated_at=now()
    where user_id=v_order.buyer_id
      and publication_id=v_order.publication_id
      and source=v_order.access_model
      and metadata->>'marketplace_order_id'=v_order.id::text;
  else
    select entitlement.order_id,entitlement.expires_at
    into v_fallback_order_id,v_fallback_expiry
    from public.marketplace_entitlements entitlement
    where entitlement.buyer_id=v_order.buyer_id
      and entitlement.course_id=v_order.course_id
      and entitlement.status='active'
      and entitlement.starts_at<=now()
      and (entitlement.expires_at is null or entitlement.expires_at>now())
    order by
      (entitlement.expires_at is null) desc,
      entitlement.expires_at desc nulls first,
      entitlement.starts_at desc
    limit 1;

    if v_fallback_order_id is null then
      delete from public.course_memberships
      where course_id=v_order.course_id
        and user_id=v_order.buyer_id
        and access_source='marketplace';
    else
      insert into public.course_memberships (
        course_id,user_id,role,access_source,access_expires_at,marketplace_order_id
      ) values (
        v_order.course_id,v_order.buyer_id,'learner','marketplace',
        v_fallback_expiry,v_fallback_order_id
      )
      on conflict (course_id,user_id) do update set
        role='learner',
        access_source='marketplace',
        access_expires_at=excluded.access_expires_at,
        marketplace_order_id=excluded.marketplace_order_id
      where course_memberships.access_source='marketplace';
    end if;
  end if;
end;
$$;

revoke all on function public.marketplace_revoke_order_entitlement(uuid,text,text)
from public,anon,authenticated;
grant execute on function public.marketplace_revoke_order_entitlement(uuid,text,text)
to service_role;
