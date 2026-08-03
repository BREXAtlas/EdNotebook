-- Final Phase 2 staging-acceptance follow-up.
-- Cover lookup-side foreign keys reported by the Supabase performance advisor.

create index if not exists student_data_intake_evidence_versions_gate_key_idx
  on public.student_data_intake_evidence_versions(gate_key);

create index if not exists student_data_lifecycle_policy_versions_domain_key_idx
  on public.student_data_lifecycle_policy_versions(domain_key);

create index if not exists student_data_subject_request_items_domain_key_idx
  on public.student_data_subject_request_items(domain_key);
