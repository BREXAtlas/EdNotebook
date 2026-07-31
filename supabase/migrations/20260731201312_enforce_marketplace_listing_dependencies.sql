-- Listing approval is the final publication gate. Recheck every upstream
-- marketplace control in the owner RPC so UI bypasses cannot publish a paid
-- item before seller, rights, tax, and Stripe readiness are all approved.

create or replace function public.review_marketplace_case(
  p_case_type text,
  p_case_id uuid,
  p_decision text,
  p_review_notes text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_listing public.marketplace_listings%rowtype;
begin
  if not private.is_platform_owner(v_user_id) then
    raise exception 'Only the platform owner can decide marketplace reviews';
  end if;
  if char_length(trim(coalesce(p_review_notes,'')))<8 then
    raise exception 'Review notes with at least eight characters are required';
  end if;

  if p_case_type='seller' then
    if p_decision not in ('approved','declined','suspended') then
      raise exception 'Choose approved, declined, or suspended';
    end if;
    if p_decision='approved' and not exists (
      select 1 from public.publisher_applications application
      where application.id=p_case_id
        and application.rights_attestation
        and application.verification_status='verified'
        and application.details_submitted
        and application.charges_enabled
        and application.payouts_enabled
    ) then
      raise exception 'Stripe seller verification, charging, and payouts are not ready';
    end if;
    update public.publisher_applications
    set status=p_decision,
        reviewed_by=v_user_id,
        reviewed_at=now(),
        review_notes=trim(p_review_notes),
        updated_at=now()
    where id=p_case_id;
  elsif p_case_type='rights' then
    if p_decision not in ('approved','declined','suspended') then
      raise exception 'Choose approved, declined, or suspended';
    end if;
    update public.publication_rights_reviews
    set status=p_decision,
        reviewed_by=v_user_id,
        reviewed_at=now(),
        review_notes=trim(p_review_notes),
        updated_at=now()
    where id=p_case_id;
  elsif p_case_type='tax' then
    if p_decision not in ('approved','suspended','retired') then
      raise exception 'Choose approved, suspended, or retired';
    end if;
    if p_decision='approved' and not exists (
      select 1 from public.marketplace_tax_controls tax
      where tax.id=p_case_id
        and char_length(trim(coalesce(tax.registration_reference,'')))>=6
    ) then
      raise exception 'Stripe Tax registration or liability evidence is required before approval';
    end if;
    update public.marketplace_tax_controls
    set status=p_decision,
        reviewed_by=v_user_id,
        reviewed_at=now(),
        review_notes=trim(p_review_notes),
        updated_at=now()
    where id=p_case_id;
  elsif p_case_type='listing' then
    if p_decision not in ('approved','suspended','retired') then
      raise exception 'Choose approved, suspended, or retired';
    end if;
    select * into v_listing
    from public.marketplace_listings
    where id=p_case_id;
    if not found then raise exception 'Marketplace listing not found'; end if;

    if p_decision='approved' then
      if not exists (
        select 1
        from public.marketplace_tax_controls tax
        where tax.id=v_listing.tax_control_id
          and tax.status='approved'
          and char_length(trim(coalesce(tax.registration_reference,'')))>=6
          and (
            tax.seller_application_id is null
            or tax.seller_application_id=v_listing.seller_application_id
          )
      ) then
        raise exception 'Tax responsibility must be approved for this marketplace listing';
      end if;
      if not exists (
        select 1
        from public.publisher_applications seller
        where seller.id=v_listing.seller_application_id
          and seller.status='approved'
          and seller.rights_attestation
          and seller.stripe_account_id is not null
          and seller.verification_status='verified'
          and seller.details_submitted
          and seller.charges_enabled
          and seller.payouts_enabled
      ) then
        raise exception 'Seller and Stripe Connect readiness must be approved for this marketplace listing';
      end if;
      if not exists (
        select 1
        from public.publication_rights_reviews rights
        where rights.id=v_listing.rights_review_id
          and rights.seller_application_id=v_listing.seller_application_id
          and rights.status='approved'
          and (rights.expires_at is null or rights.expires_at>now())
          and (
            (v_listing.access_model='purchase' and rights.purchase_allowed)
            or (v_listing.access_model='rental' and rights.rental_allowed)
          )
      ) then
        raise exception 'Commercial rights must be approved for this marketplace listing';
      end if;
    end if;

    update public.marketplace_listings
    set status=p_decision,
        reviewed_by=v_user_id,
        reviewed_at=now(),
        review_notes=trim(p_review_notes),
        published_at=case when p_decision='approved' then coalesce(published_at,now()) else published_at end,
        updated_at=now()
    where id=p_case_id
    returning * into v_listing;

    if p_decision='approved' then
      if v_listing.item_kind='course' then
        update public.published_course_directory
        set library_access_model=v_listing.access_model,
            library_listing_status='published',
            library_price_cents=v_listing.price_cents,
            library_rental_days=v_listing.rental_days,
            library_published_at=coalesce(library_published_at,now()),
            updated_at=now()
        where course_id=v_listing.course_id;
      else
        update public.publications
        set access_model=v_listing.access_model,
            price_cents=v_listing.price_cents,
            rental_days=v_listing.rental_days,
            status='published',
            published_at=coalesce(published_at,now()),
            updated_at=now()
        where id=v_listing.publication_id;
      end if;
      update public.marketplace_listings
      set status='published',updated_at=now()
      where id=v_listing.id;
    else
      if v_listing.item_kind='course' then
        update public.published_course_directory
        set library_listing_status='suspended',updated_at=now()
        where course_id=v_listing.course_id;
      else
        update public.publications
        set status='suspended',updated_at=now()
        where id=v_listing.publication_id;
      end if;
    end if;
  elsif p_case_type='refund' then
    if p_decision not in ('approved','declined') then
      raise exception 'Choose approved or declined';
    end if;
    update public.marketplace_refund_requests
    set status=p_decision,
        reviewed_by=v_user_id,
        reviewed_at=now(),
        review_notes=trim(p_review_notes),
        updated_at=now()
    where id=p_case_id
      and status in ('requested','reviewing');
  else
    raise exception 'Unknown marketplace case type';
  end if;

  if not found then raise exception 'Marketplace review record not found or no longer reviewable'; end if;
  return jsonb_build_object(
    'case_type',p_case_type,
    'case_id',p_case_id,
    'decision',p_decision,
    'reviewed_by',v_user_id,
    'reviewed_at',now()
  );
end;
$$;

revoke all on function public.review_marketplace_case(text,uuid,text,text)
from public,anon;
grant execute on function public.review_marketplace_case(text,uuid,text,text)
to authenticated;
