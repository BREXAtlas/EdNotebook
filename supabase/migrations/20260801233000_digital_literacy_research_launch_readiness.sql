-- Digital Literacy pilot launch-readiness evidence.
--
-- This is a read-only, course-manager view of the existing fail-closed
-- research controls. It does not create a research project, record an IRB/HRPP
-- determination, enable the course feature, activate collection, or expose
-- participant responses.

create or replace function public.get_digital_literacy_research_launch_readiness(
  p_course_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_course public.courses%rowtype;
  v_release_id text;
  v_release_units integer := 0;
  v_projects jsonb := '[]'::jsonb;
  v_collection_active boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not private.can_manage_course(p_course_id) then
    raise exception 'Course management access required';
  end if;

  select * into v_course
  from public.courses
  where id = p_course_id;
  if not found then
    raise exception 'Course not found';
  end if;

  select release.release_id, count(unit.unit_id)::integer
  into v_release_id, v_release_units
  from public.digital_literacy_catalog_releases release
  left join public.digital_literacy_catalog_units unit
    on unit.release_id = release.release_id
  where release.course_key = 'brexatlas.digital-literacy-course'
    and release.active
  group by release.release_id
  order by release.created_at desc
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'project_id', project_state.project_id,
        'project_title', project_state.project_title,
        'version_id', project_state.version_id,
        'version_number', project_state.version_number,
        'version_status', project_state.version_status,
        'purpose_statement', project_state.purpose_statement,
        'blockers', project_state.blockers,
        'collection_active', project_state.collection_active,
        'latest_determination', case
          when project_state.approval_id is null then null
          else jsonb_build_object(
            'decision', project_state.approval_decision,
            'determination_type', project_state.determination_type,
            'official_body', project_state.official_body,
            'decision_date', project_state.decision_date,
            'effective_at', project_state.approval_effective_at,
            'expires_at', project_state.approval_expires_at
          )
        end,
        'checks', jsonb_build_array(
          jsonb_build_object(
            'key', 'immutable_research_version',
            'status', case when project_state.version_id is not null then 'pass' else 'blocked' end
          ),
          jsonb_build_object(
            'key', 'written_determination',
            'status', case
              when project_state.approval_decision = 'approved'
                and project_state.approval_effective_at <= now()
                and project_state.approval_expires_at > now()
              then 'pass' else 'blocked' end
          ),
          jsonb_build_object(
            'key', 'participant_notice_and_consent',
            'status', case when not (
              project_state.blockers ?| array[
                'participant_notice_incomplete',
                'consent_configuration_incomplete',
                'consent_configuration_mismatch'
              ]
            ) then 'pass' else 'blocked' end
          ),
          jsonb_build_object(
            'key', 'approved_instrument_scope',
            'status', case when not (
              project_state.blockers ?| array[
                'instrument_version_missing',
                'paired_pre_post_instruments_required',
                'qualitative_instrument_required',
                'open_ended_instrument_required'
              ]
            ) then 'pass' else 'blocked' end
          ),
          jsonb_build_object(
            'key', 'course_feature_control',
            'status', case
              when not (project_state.blockers ? 'course_research_feature_disabled')
              then 'pass' else 'blocked' end
          ),
          jsonb_build_object(
            'key', 'explicit_version_activation',
            'status', case when project_state.collection_active then 'pass' else 'blocked' end
          ),
          jsonb_build_object(
            'key', 'governed_pseudonymized_export',
            'status', case
              when project_state.export_mode = 'approved_scoped'
                and project_state.minimum_cohort_size >= 3
                and project_state.export_secret_present
              then 'pass' else 'blocked' end
          )
        )
      ) order by project_state.collection_active desc, project_state.version_number desc
    ),
    '[]'::jsonb
  ) into v_projects
  from (
    select
      project.id as project_id,
      project.title as project_title,
      version.id as version_id,
      version.version_number,
      version.status as version_status,
      version.purpose_statement,
      version.export_rules->>'mode' as export_mode,
      case
        when coalesce(version.export_rules->>'minimum_cohort_size', '') ~ '^[0-9]+$'
          then greatest(3, least(100, (version.export_rules->>'minimum_cohort_size')::integer))
        else 5
      end as minimum_cohort_size,
      private.research_version_blockers(version.id, true, now()) as blockers,
      version.status = 'active'
        and private.research_version_blockers(version.id, true, now()) = '[]'::jsonb
        as collection_active,
      approval.id as approval_id,
      approval.decision as approval_decision,
      approval.determination_type,
      approval.official_body,
      approval.decision_date,
      approval.effective_at as approval_effective_at,
      approval.expires_at as approval_expires_at,
      exists (
        select 1
        from private.research_export_secrets secret
        where secret.pilot_version_id = version.id
      ) as export_secret_present
    from public.research_pilot_projects project
    join lateral (
      select version_row.*
      from public.research_pilot_versions version_row
      where version_row.project_id = project.id
      order by (version_row.status = 'active') desc, version_row.version_number desc
      limit 1
    ) version on true
    left join lateral (
      select approval_row.*
      from public.research_pilot_approval_records approval_row
      where approval_row.pilot_version_id = version.id
      order by approval_row.recorded_at desc, approval_row.id desc
      limit 1
    ) approval on true
    where project.course_id = p_course_id
  ) project_state;

  select exists (
    select 1
    from jsonb_array_elements(v_projects) project
    where (project->>'collection_active')::boolean
  ) into v_collection_active;

  return jsonb_build_object(
    'course_id', p_course_id,
    'course_title', v_course.title,
    'ordinary_coursework_open', true,
    'research_participation_required_for_coursework', false,
    'research_collection_active', v_collection_active,
    'launch_state', case
      when jsonb_array_length(v_projects) = 0 then 'research_not_configured'
      when v_collection_active then 'approved_version_active'
      else 'blocked_pending_governance'
    end,
    'canonical_course', jsonb_build_object(
      'course_key', 'brexatlas.digital-literacy-course',
      'release_id', v_release_id,
      'unit_count', v_release_units,
      'status', case when v_release_id is not null and v_release_units = 40 then 'pass' else 'blocked' end
    ),
    'export_boundary', jsonb_build_object(
      'direct_identifiers_included', false,
      'participant_code', 'version_specific_keyed_hmac',
      'minimum_cohort_floor', 3,
      'qualitative_text', 'manual_disclosure_review_required',
      'pseudonymized_is_anonymous', false
    ),
    'projects', v_projects
  );
end;
$$;

comment on function public.get_digital_literacy_research_launch_readiness(uuid)
is 'Read-only course-manager evidence for the fail-closed Digital Literacy research launch boundary; returns no participant responses or direct identifiers.';

revoke all on function public.get_digital_literacy_research_launch_readiness(uuid)
from public, anon;
grant execute on function public.get_digital_literacy_research_launch_readiness(uuid)
to authenticated;
