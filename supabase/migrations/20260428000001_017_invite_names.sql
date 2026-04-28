-- Phase 5b / Migration 017 — invites.first_name + invites.last_name
--
-- Additive, nullable. Captured by the club-admin invite UI on /manage/members
-- (and by the super-admin admin-invite path once that gets a UI). The Phase 5
-- /me/setup wizard reads them via lookupInvite() to prefill step 1; player
-- can edit before submit. Closes the Phase 3 follow-up drift item where
-- signup first_name / last_name fields were rendered + submitted but ignored.
--
-- Existing rows: pre-launch, no data to backfill. Nullable columns leave them
-- harmless for any historical row that ever appears in dev.

alter table public.invites
  add column first_name text,
  add column last_name text;
