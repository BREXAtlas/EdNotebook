-- Cover template ownership lookups and foreign-key maintenance.
create index assignment_form_templates_created_by_idx
  on public.assignment_form_templates (created_by);
