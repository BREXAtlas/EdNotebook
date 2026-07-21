update public.storage_plan_limits
set max_file_bytes = case
  when plan_key='free' then 26214400
  when plan_key='starter' then 104857600
  when plan_key='professor' then 262144000
  when plan_key in ('institution','enterprise') then 536870912
  else least(max_file_bytes,536870912)
end,
updated_at=now();

update public.plan_entitlements pe
set entitlement_value=to_jsonb(spl.max_file_bytes),updated_at=now()
from public.storage_plan_limits spl
where pe.plan_key=spl.plan_key and pe.entitlement_key='max_file_bytes';
