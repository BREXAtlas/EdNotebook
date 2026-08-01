create index if not exists marketplace_commerce_launch_activated_by_idx
  on public.marketplace_commerce_launch (activated_by)
  where activated_by is not null;

create index if not exists marketplace_launch_controls_reviewed_by_idx
  on public.marketplace_launch_controls (reviewed_by)
  where reviewed_by is not null;
