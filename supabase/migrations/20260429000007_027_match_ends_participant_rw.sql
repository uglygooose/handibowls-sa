-- Phase 8d-prep-2 / Migration 027 — match_ends participant UPDATE/DELETE
-- + updated_at column for LWW comparisons
--
-- Phase 8d uncovered three coupled gaps during the offline outbox-flush
-- wiring:
--
--   1. `match_ends_participant_submit` lets participants INSERT only.
--      The LWW outbox flush needs UPDATE for re-syncing edited ends
--      (player corrects an end before final submission); the scorecard's
--      "Remove end" affordance needs DELETE.
--
--   2. The Phase-2 schema gave match_ends `submitted_at` (set on INSERT,
--      stable thereafter) but no `updated_at` — by design, when ends were
--      append-only. The Phase-8 player edit-an-end UX requires a
--      monotonically-bumping timestamp for LWW comparisons against the
--      Dexie outbox's `localUpdatedAt`. Adding `updated_at` + the
--      shared `set_updated_at` trigger.
--
--   3. Both new policies gate on:
--        a. `is_match_participant(match_id, auth.uid())` — same predicate
--           the existing INSERT/SELECT policies use, so the auth model
--           stays uniform across the four CRUD verbs.
--        b. The match's `finalized_by_admin` flag — once admin verification
--           lands, scoring locks. UI also hides edit affordances; this is
--           the defence-in-depth backstop.
--
-- Admins keep their full RW access via `match_ends_host_admin_rw`
-- (existing) and `match_ends_super_admin_all` (existing). Those policies
-- aren't gated on finalized_by_admin because admin override is the
-- mechanism for editing post-verification — the dispute-resolution
-- workflow Phase 8d-prep already documented in verifyMatch.

-- 1. updated_at column + trigger for LWW ----------------------------------
alter table public.match_ends
  add column updated_at timestamptz not null default now();

create trigger match_ends_set_updated_at
  before update on public.match_ends
  for each row execute function public.set_updated_at();

-- 2. Participant UPDATE policy --------------------------------------------
create policy match_ends_participant_update on public.match_ends
  for update to authenticated
  using (
    public.is_match_participant(match_id, auth.uid())
    and not exists (
      select 1 from public.matches m
       where m.id = match_ends.match_id
         and m.finalized_by_admin = true
    )
  )
  with check (
    public.is_match_participant(match_id, auth.uid())
    and not exists (
      select 1 from public.matches m
       where m.id = match_ends.match_id
         and m.finalized_by_admin = true
    )
  );

-- 3. Participant DELETE policy --------------------------------------------
create policy match_ends_participant_delete on public.match_ends
  for delete to authenticated
  using (
    public.is_match_participant(match_id, auth.uid())
    and not exists (
      select 1 from public.matches m
       where m.id = match_ends.match_id
         and m.finalized_by_admin = true
    )
  );
