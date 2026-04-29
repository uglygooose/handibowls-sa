-- Phase 8d-prep / Migration 026 — match submission lifecycle
--
-- Splits the captain-submitted / opponent-confirmed handshake out of
-- `match_status` into a dedicated column. Rationale: `match_status`
-- tracks scheduling/completion (scheduled → in_progress → completed
-- → walkover/cancelled) and is queried widely; the verification
-- handshake is an orthogonal sub-state that the Phase-8c scorecard
-- needs but only handful of flows actually care about. Keeping them
-- separate avoids polluting the primary lifecycle enum + makes future
-- sub-states (e.g. admin_disputed) cheap to add.
--
-- The two timestamp columns double as the audit trail — when did the
-- captain submit, how long did the opponent take to confirm.
--
-- Decision context: see Phase 8d-prep architectural-decision report.
-- Three options were considered (extend match_status enum / split
-- column / derive from timestamps); split column won on
-- separation-of-concerns + future-flexibility grounds.

-- 1. New enum -------------------------------------------------------------
create type submission_status as enum (
  'pending',            -- no captain has posted scores yet (default)
  'captain_submitted',  -- one captain posted; opposing captain must confirm
  'opponent_confirmed'  -- both captains agree; awaiting admin verification
);

-- 2. Columns --------------------------------------------------------------
-- Default 'pending' so every existing row is immediately consistent
-- without a backfill — the audit timestamps stay null until the first
-- captain submission.
alter table public.matches
  add column submission_status submission_status not null default 'pending',
  add column captain_submitted_at timestamptz,
  add column opponent_confirmed_at timestamptz;

-- 3. Consistency check ----------------------------------------------------
-- Self-documenting CHECK that pins the (status, timestamp-set)
-- relationship. Prevents impossible states like "opponent_confirmed
-- with no captain_submitted_at" or "captain_submitted with both
-- timestamps populated". Admin-override paths (verifyMatch with
-- override_home_shots / override_away_shots) bypass this lifecycle
-- entirely — the constraint only fires on rows where the lifecycle
-- has been engaged.
alter table public.matches
  add constraint matches_submission_consistent check (
    (submission_status = 'pending'
       and captain_submitted_at is null
       and opponent_confirmed_at is null)
    or (submission_status = 'captain_submitted'
       and captain_submitted_at is not null
       and opponent_confirmed_at is null)
    or (submission_status = 'opponent_confirmed'
       and captain_submitted_at is not null
       and opponent_confirmed_at is not null)
  );

-- 4. Partial index --------------------------------------------------------
-- Drives the Phase-8 player surfaces' "show me my pending confirmations"
-- query (8d wires the inbox/banner notifications for opponents waiting
-- on a captain to confirm). Partial because the vast majority of rows
-- sit in 'pending' or 'opponent_confirmed' — neither needs the index.
create index matches_submission_pending_confirms_idx
  on public.matches (submission_status)
  where submission_status in ('captain_submitted', 'opponent_confirmed');

-- 5. Backfill ------------------------------------------------------------
-- For existing rows with status='completed' (final scores already in
-- place via the Phase 7 admin path), promote submission_status to
-- 'opponent_confirmed' so the captain/opponent handshake doesn't
-- prompt for already-decided matches. The audit timestamps fall back
-- to the match's updated_at since we don't know the precise submission
-- moment for legacy rows.
update public.matches
   set submission_status     = 'opponent_confirmed',
       captain_submitted_at  = updated_at,
       opponent_confirmed_at = updated_at
 where status = 'completed';

-- Walkover / cancelled rows stay at 'pending' — the lifecycle never
-- engaged. Admin-override paths (verifyMatch + walkover declaration)
-- skip the handshake entirely.
