-- Phase 13 / 13-2b / Batch E — Migration 043
-- POPIA compliance schema — soft-delete columns + audit retention
-- category + pg_cron extension.
--
-- This migration is schema-only; the RLS policy updates that filter
-- on the new soft-delete columns ship in Batch F, the deletion +
-- export endpoints + cron schedules ship in Batch G, the UI
-- (/me/settings/data-and-privacy + cross-user "Deleted player"
-- sweep) ships in Batch H. L55 two-commit rule per the
-- phase-discipline skill: this migration cloud-applies + verifies
-- before any application code that depends on the new schema.
--
-- Scope (5 changes):
--
--   1. profiles.deleted_at timestamptz (nullable). NULL = active;
--      non-NULL = soft-deleted. Set by the requestAccountDeletion
--      action (Batch G). 30-day grace window measured from this
--      timestamp; after the window, pg_cron runs the anonymise
--      job (Batch G migration extending pg_cron schedules).
--      Survives anonymisation — remains set on the row to mark
--      "this row has been hard-deleted, PII columns are
--      intentionally NULL".
--
--   2. profiles.pending_auth_ban boolean default false. Set to
--      TRUE by the pg_cron anonymise job after PII columns are
--      nulled. Vercel Cron's /api/cron/anonymise-pending route
--      (Batch G) polls profiles where pending_auth_ban = true
--      AND auth_banned_at IS NULL, calls the Supabase Auth Admin
--      API to set auth.users.banned_until = 'infinity', then
--      writes auth_banned_at on the profile row. Hybrid model
--      per § 8.2 design check.
--
--   3. profiles.auth_banned_at timestamptz (nullable). Set by the
--      Vercel Cron route after the Auth Admin API ban succeeds.
--      Allows alerting on rows pending > N hours (Batch G
--      monitoring concern).
--
--   4. audit_log.retention_category enum (audit_retention_category)
--      with default 'operational'. Three values:
--        - operational  → 30-day retention (booking lifecycle,
--                         force-state-change events)
--        - compliance   → 7-year retention (POPIA Section
--                         23(2)(c) — invite acceptance, consent
--                         capture, account deletion, data
--                         export, rubric activation)
--        - financial    → 7-year retention (future payment-
--                         related entries; no current rows)
--      Existing 332 audit_log rows backfilled per their action
--      column. Future RPC inserts should specify retention_category
--      explicitly; the default safely catches any miss.
--
--   5. pg_cron extension enabled. Schedule statements ship in
--      Batch G's migration (when the cron jobs are written).
--      Enabling the extension here so Batch G's migration can
--      assume it's available without a precondition check.
--
-- C1-style schema-vs-reality check: confirmed against the locked
-- decisions before writing. The three design questions in § 8.1
-- / § 8.2 / § 8.3 of the scoping report were resolved by the user
-- (anonymise-not-delete for consents, hybrid pg_cron + Vercel Cron
-- for auth.users ban, skip re-consent on restore). This migration
-- ships exactly what those decisions specified plus invariant
-- CHECK constraints to prevent bad-state writes from future bugs.

-- 1. audit_retention_category enum -----------------------------------------

create type public.audit_retention_category as enum (
  'operational',
  'compliance',
  'financial'
);

comment on type public.audit_retention_category is
  'POPIA-aligned retention buckets for audit_log rows. operational '
  '→ 30 days; compliance → 7 years (POPIA Section 23(2)(c)); '
  'financial → 7 years. The pg_cron retention-enforcement job '
  '(Batch G) deletes operational rows older than 30 days and '
  'preserves compliance + financial rows up to their respective '
  'horizons. Default at INSERT is operational (least-retentive, '
  'conservative); RPCs writing compliance-class events should '
  'specify the category explicitly.';

-- 2. audit_log.retention_category column + backfill ------------------------

alter table public.audit_log
  add column retention_category public.audit_retention_category
    not null default 'operational';

comment on column public.audit_log.retention_category is
  'Which retention bucket this row lives in. See type comment for '
  'horizon details. Backfilled at migration time from the action '
  'column for the 4 pre-existing distinct actions; future RPC '
  'inserts should set this explicitly when writing compliance-'
  'class events (e.g. activate_rubric_version, account deletion, '
  'data export).';

-- Backfill the 332 existing rows. The 4 distinct action values
-- map cleanly: invite_accepted_* events are POPIA consent-capture
-- (compliance, 7-year); force_cancel_booking + force_state_change
-- are operational (30-day, default).
update public.audit_log
   set retention_category = 'compliance'
 where action in ('invite_accepted_existing_user', 'invite_accepted_new_user');

-- 3. profiles soft-delete columns ------------------------------------------

alter table public.profiles
  add column deleted_at timestamptz,
  add column pending_auth_ban boolean not null default false,
  add column auth_banned_at timestamptz;

comment on column public.profiles.deleted_at is
  'Soft-delete timestamp. NULL = active; non-NULL = soft-deleted. '
  'Set by requestAccountDeletion action (Batch G). 30-day grace '
  'window measured from this value; after the window, pg_cron '
  'anonymises the PII columns (first_name, last_name, display_name, '
  'email, phone, gender, date_of_birth, bsa_number, avatar_url) by '
  'setting them to NULL. deleted_at itself is preserved through '
  'anonymisation as the marker that this row has been hard-deleted.';

comment on column public.profiles.pending_auth_ban is
  'Set to TRUE by the pg_cron anonymise job after PII columns are '
  'nulled. Vercel Cron route /api/cron/anonymise-pending (Batch G) '
  'picks up pending_auth_ban=true AND auth_banned_at IS NULL, calls '
  'Supabase Auth Admin API to set auth.users.banned_until = '
  '''infinity'', writes auth_banned_at, leaves pending_auth_ban=true. '
  'Hybrid pg_cron + Vercel Cron model per scoping § 8.2.';

comment on column public.profiles.auth_banned_at is
  'Set by the Vercel Cron anonymise-pending route after the Supabase '
  'Auth Admin API ban call succeeds. NULL while pending; non-NULL '
  'after ban applied. Used by monitoring (Batch G) to alert on rows '
  'pending > N hours (cron failure, API outage, etc.).';

-- Invariant CHECK constraints — prevent bad-state writes.

alter table public.profiles
  add constraint profiles_auth_ban_requires_deletion check (
    pending_auth_ban = false
    or deleted_at is not null
  );

comment on constraint profiles_auth_ban_requires_deletion on public.profiles is
  'pending_auth_ban=true is only meaningful for soft-deleted profiles. '
  'Prevents an active user from having their auth.users entry queued for '
  'banning by accident.';

alter table public.profiles
  add constraint profiles_auth_banned_after_pending check (
    auth_banned_at is null
    or pending_auth_ban = true
  );

comment on constraint profiles_auth_banned_after_pending on public.profiles is
  'auth_banned_at can only be set after pending_auth_ban was raised. '
  'Pins the state machine: deletion request → soft-delete (deleted_at '
  'set) → grace window → anonymise (pending_auth_ban set) → ban applied '
  '(auth_banned_at set). Out-of-order writes fail loudly.';

-- 4. pg_cron extension ------------------------------------------------------
-- Schedule statements ship in Batch G's migration alongside the cron-job
-- bodies. Enabling here so Batch G can `cron.schedule(...)` without an
-- "extension does not exist" precondition.

create extension if not exists pg_cron;

comment on extension pg_cron is
  'Job scheduler for cleanup jobs added in Phase 13 / 13-2b / Batch G '
  '(soft-delete → anonymise after 30-day grace; audit_log retention '
  'enforcement). Hybrid model: pg_cron handles SQL-only work; Vercel '
  'Cron handles the Supabase Auth Admin API calls.';
