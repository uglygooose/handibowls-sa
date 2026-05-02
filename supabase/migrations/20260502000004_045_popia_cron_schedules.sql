-- Phase 13 / 13-2b / Batch G3a — Migration 045
-- POPIA cron jobs — anonymise grace-expired profiles + enforce
-- audit_log retention horizons.
--
-- Two SECURITY DEFINER functions called by pg_cron schedules:
--
--   public.popia_anonymise_pending_run()
--     Walks profiles where deleted_at is past the 30-day grace
--     window AND pending_auth_ban = false. For each row: NULLs
--     all PII columns, flips pending_auth_ban=true, writes a
--     compliance-tier audit_log row. The Vercel Cron handler at
--     /api/cron/anonymise-pending (Batch G3b) picks up
--     pending_auth_ban=true rows + calls the Supabase Auth Admin
--     API to ban the auth.users row.
--
--   public.popia_audit_retention_run()
--     Deletes audit_log rows past their retention horizons:
--       operational  → performed_at < now() - 30 days
--       compliance   → performed_at < now() - 7 years
--       financial    → performed_at < now() - 7 years
--     Returns a per-bucket count of rows deleted (visible in
--     pg_cron.job_run_details for monitoring).
--
-- Both functions:
--   - SECURITY DEFINER so they run with the migration owner's
--     privileges (cron-driven SQL has no auth.uid() context;
--     RLS would deny INSERT/DELETE without elevation).
--   - REVOKE from public + no GRANT to authenticated. They're
--     not callable from app code; only pg_cron + service-role
--     (used for manual testing) reach them.
--   - search_path pinned to (public, pg_catalog) per the
--     existing SECURITY DEFINER convention in 030/031/035/037/042.
--   - Idempotent under re-run: anonymise function skips already-
--     flagged rows; retention function deletes nothing if no
--     rows are past their horizon.
--
-- Cron schedules:
--   popia_anonymise_pending  → 03:00 UTC nightly (05:00 SAST,
--                              low-traffic window)
--   popia_audit_retention    → 03:15 UTC nightly (offset by
--                              15min so the two jobs don't
--                              collide on lock contention if
--                              audit_log is heavily written)
--
-- Idempotent migration: cron.unschedule() is called first for
-- both job names so re-running migration 045 doesn't create
-- duplicate jobs (cron.schedule with the same name does
-- update-not-error, but the explicit unschedule guards against
-- partial rollouts).

-- 1. Anonymise function -----------------------------------------------------

create or replace function public.popia_anonymise_pending_run()
returns table(anonymised_count integer, audited_count integer)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_target_id uuid;
  v_anonymised integer := 0;
  v_audited integer := 0;
begin
  for v_target_id in
    select id
      from public.profiles
     where deleted_at is not null
       and deleted_at < now() - interval '30 days'
       and pending_auth_ban = false
  loop
    update public.profiles
       set first_name = null,
           last_name = null,
           display_name = null,
           email = null,
           phone = null,
           bsa_number = null,
           gender = null,
           date_of_birth = null,
           avatar_url = null,
           pending_auth_ban = true
     where id = v_target_id;

    insert into public.audit_log (
      table_name, row_id, action, reason, payload,
      performed_by, retention_category
    ) values (
      'profiles',
      v_target_id,
      'profile_anonymised',
      'pg_cron POPIA anonymise after 30-day grace window.',
      jsonb_build_object('automated', true),
      null,
      'compliance'
    );

    v_anonymised := v_anonymised + 1;
    v_audited := v_audited + 1;
  end loop;

  return query select v_anonymised, v_audited;
end;
$$;

revoke all on function public.popia_anonymise_pending_run() from public;

comment on function public.popia_anonymise_pending_run() is
  'POPIA anonymise sweep — nullifies PII columns on profiles past '
  'the 30-day grace window + flags pending_auth_ban=true. Called '
  'nightly by pg_cron job ''popia_anonymise_pending''. The Vercel '
  'Cron handler at /api/cron/anonymise-pending picks up the flagged '
  'rows + bans the auth.users entry via Supabase Auth Admin API. '
  'Returns (anonymised_count, audited_count) for cron monitoring.';

-- 2. Retention enforcement function -----------------------------------------

create or replace function public.popia_audit_retention_run()
returns table(
  operational_deleted integer,
  compliance_deleted integer,
  financial_deleted integer
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_op integer;
  v_co integer;
  v_fi integer;
begin
  delete from public.audit_log
   where retention_category = 'operational'
     and performed_at < now() - interval '30 days';
  get diagnostics v_op = row_count;

  delete from public.audit_log
   where retention_category = 'compliance'
     and performed_at < now() - interval '7 years';
  get diagnostics v_co = row_count;

  delete from public.audit_log
   where retention_category = 'financial'
     and performed_at < now() - interval '7 years';
  get diagnostics v_fi = row_count;

  return query select v_op, v_co, v_fi;
end;
$$;

revoke all on function public.popia_audit_retention_run() from public;

comment on function public.popia_audit_retention_run() is
  'POPIA audit_log retention sweep — deletes rows past their '
  'category-specific horizons (operational 30d, compliance 7y, '
  'financial 7y). Called nightly by pg_cron job '
  '''popia_audit_retention''. Returns (operational_deleted, '
  'compliance_deleted, financial_deleted) for cron monitoring.';

-- 3. Schedule the jobs ------------------------------------------------------

-- Idempotent: unschedule first so re-running this migration
-- doesn't double-schedule. cron.unschedule raises if the job
-- doesn't exist; wrap in a do block that swallows the not-
-- found error.
do $$
begin
  perform cron.unschedule('popia_anonymise_pending');
exception when others then null;
end$$;

do $$
begin
  perform cron.unschedule('popia_audit_retention');
exception when others then null;
end$$;

select cron.schedule(
  'popia_anonymise_pending',
  '0 3 * * *',
  $$select public.popia_anonymise_pending_run();$$
);

select cron.schedule(
  'popia_audit_retention',
  '15 3 * * *',
  $$select public.popia_audit_retention_run();$$
);
