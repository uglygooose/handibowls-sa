-- Phase 8d follow-up / Migration 028 — matches participant UPDATE
-- + BEFORE-UPDATE guard trigger
--
-- Phase 8d Diagnostic 1 surfaced an RLS gap: matches_participant_submit
-- (existing) gives participants SELECT only. submitMatch + confirmMatch
-- both UPDATE the matches row from the player's session, so both were
-- silently no-opping (PostgREST 200 with zero rows affected, no error).
-- The Dexie outbox flush worked because migration 027 had already added
-- participant UPDATE/DELETE for `match_ends`; this is the parallel fix
-- for the parent `matches` row.
--
-- Layered defence
--
-- (A) Standard RLS UPDATE policy mirrors migration 027's match_ends
--     pattern: participants of the match (home or away team_member)
--     can UPDATE rows where finalized_by_admin = false. Admin lock
--     via the same predicate.
--
-- (B) BEFORE UPDATE trigger enforces column-level + state-machine
--     guarantees for participant writes. RLS gates which rows you can
--     touch; the trigger gates which columns you can move and which
--     submission_status transitions are legal. Two guarantees the
--     simple RLS policy can't express:
--
--       1. Participants must NOT change scheduling/bracket structure
--          (tournament_id, home/away_team_id, rink_id, round,
--          bracket_slot, match_no, slot_*_source_*, starts/ends_at,
--          notes) or finalized_by_admin. Reasoning: malicious or buggy
--          participant clients could flip finalized_by_admin=true to
--          lock out admin override, or reassign team membership to
--          break the bracket. Application layer already restricts this
--          to the legal columns (submitMatch only writes home_shots/
--          away_shots/status/submission_status/captain_submitted_at;
--          confirmMatch only writes submission_status/
--          opponent_confirmed_at/winner_team_id), but defence-in-depth
--          backstops a future bug or hostile crafted UPDATE.
--
--       2. winner_team_id has a confirmMatch carve-out: participants
--          MAY write it in the same UPDATE that transitions
--          submission_status from captain_submitted to opponent_confirmed
--          (confirmMatch derives the winner from already-stored agreed
--          scores). All other contexts: admin-only.
--
--       3. status + submission_status must follow the documented state
--          machine (Phase 8d-prep contract):
--            status: scheduled -> in_progress (submitMatch path).
--                    in_progress -> in_progress (re-submit refresh).
--                    Anything else (completed / walkover / cancelled)
--                    is admin-only via verifyMatch / cancelMatch.
--            submission_status: pending -> captain_submitted (submitMatch).
--                              captain_submitted -> captain_submitted
--                                (re-submit refresh).
--                              captain_submitted -> opponent_confirmed
--                                (confirmMatch).
--                              opponent_confirmed -> opponent_confirmed
--                                (idempotent no-op).
--
--       4. Audit timestamps (captain_submitted_at, opponent_confirmed_at)
--          are FROZEN once set. submitMatch's action body still sends
--          captain_submitted_at=now() on every call (its original
--          "freshness" contract); the trigger silently restores OLD's
--          value on re-submits so the audit trail tracks first-submission,
--          not last-edit. If a "last-edited-at" signal is needed later,
--          add a separate column — don't conflate it with the audit
--          timestamp.
--
-- (C) The guard's gate path: skip when current_role() is null
--     (service-role / unauthenticated direct DB access — already past
--     RLS via service-role bypass; the seed script uses this path) OR
--     when current_role() is super_admin / club_admin (their own
--     UPDATE policies cover them — admin override paths legitimately
--     write finalized_by_admin, winner_team_id, etc. via verifyMatch).
--     Trigger only enforces for player-role updates that came through
--     matches_participant_update.
--
-- Why no column-level GRANTs: Postgres column GRANTs are role-level
-- (one role gets one set), but `authenticated` is shared by player +
-- club_admin + super_admin. Restricting columns at GRANT level would
-- break admin paths. Per-role differentiation lives in RLS / triggers.

-- 1. Participant UPDATE policy --------------------------------------------
create policy matches_participant_update on public.matches
  for update to authenticated
  using (
    (
      public.is_team_member(home_team_id, auth.uid())
      or public.is_team_member(away_team_id, auth.uid())
    )
    and finalized_by_admin = false
  )
  with check (
    (
      public.is_team_member(home_team_id, auth.uid())
      or public.is_team_member(away_team_id, auth.uid())
    )
    and finalized_by_admin = false
  );

-- 2. Column + state-machine guard ----------------------------------------
create or replace function public.matches_participant_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_role user_role;
begin
  v_role := public.current_role();

  -- Skip the guard for admin paths and service-role / unauthenticated
  -- direct DB access. Their own policies + bypass cover legitimate
  -- writes to admin-derived fields.
  if v_role is null or v_role in ('super_admin', 'club_admin') then
    return new;
  end if;

  -- ---- Immutable scheduling / bracket / identity columns ------------
  if (new.id is distinct from old.id)
     or (new.tournament_id is distinct from old.tournament_id)
     or (new.home_team_id is distinct from old.home_team_id)
     or (new.away_team_id is distinct from old.away_team_id)
     or (new.rink_id is distinct from old.rink_id)
     or (new.match_no is distinct from old.match_no)
     or (new.round is distinct from old.round)
     or (new.bracket_slot is distinct from old.bracket_slot)
     or (new.section_label is distinct from old.section_label)
     or (new.starts_at is distinct from old.starts_at)
     or (new.ends_at is distinct from old.ends_at)
     or (new.slot_a_source_type is distinct from old.slot_a_source_type)
     or (new.slot_a_source_match_id is distinct from old.slot_a_source_match_id)
     or (new.slot_b_source_type is distinct from old.slot_b_source_type)
     or (new.slot_b_source_match_id is distinct from old.slot_b_source_match_id)
     or (new.notes is distinct from old.notes)
  then
    raise exception 'matches_participant_update_guard: scheduling/bracket/identity columns are immutable for participants';
  end if;

  -- ---- Admin-derived fields ----------------------------------------
  -- finalized_by_admin: admin-only (verifyMatch path).
  if new.finalized_by_admin is distinct from old.finalized_by_admin then
    raise exception 'matches_participant_update_guard: finalized_by_admin is admin-only';
  end if;

  -- winner_team_id: participants may write ONLY in the same UPDATE that
  -- transitions submission_status from 'captain_submitted' to
  -- 'opponent_confirmed' (confirmMatch path — opposing captain confirms,
  -- winner is deterministically derived from already-stored scores).
  -- All other contexts: admin-only.
  if new.winner_team_id is distinct from old.winner_team_id then
    if not (
      old.submission_status = 'captain_submitted'
      and new.submission_status = 'opponent_confirmed'
    ) then
      raise exception 'matches_participant_update_guard: winner_team_id may only change on captain_submitted -> opponent_confirmed';
    end if;
  end if;

  -- ---- Audit-timestamp preservation --------------------------------
  -- Once captain_submitted_at / opponent_confirmed_at is set, it's
  -- frozen for participants. submitMatch's action body sets
  -- captain_submitted_at=now() on every call (its original "freshness"
  -- contract); the trigger silently restores OLD's value on re-submits
  -- so the audit trail tracks first-submission, not last-edit. If a
  -- "last-edited-at" signal is needed later, add a separate column —
  -- don't conflate it with the submission audit timestamp.
  if old.captain_submitted_at is not null then
    new.captain_submitted_at := old.captain_submitted_at;
  end if;
  if old.opponent_confirmed_at is not null then
    new.opponent_confirmed_at := old.opponent_confirmed_at;
  end if;

  -- ---- status state machine -----------------------------------------
  if new.status is distinct from old.status then
    if not (
         (old.status = 'scheduled'   and new.status = 'in_progress')
      or (old.status = 'in_progress' and new.status = 'in_progress')
    ) then
      raise exception 'matches_participant_update_guard: illegal status transition % -> %', old.status, new.status;
    end if;
  end if;

  -- ---- submission_status state machine ------------------------------
  if new.submission_status is distinct from old.submission_status then
    if not (
         (old.submission_status = 'pending'            and new.submission_status = 'captain_submitted')
      or (old.submission_status = 'captain_submitted'  and new.submission_status in ('captain_submitted', 'opponent_confirmed'))
    ) then
      raise exception 'matches_participant_update_guard: illegal submission_status transition % -> %',
                       old.submission_status, new.submission_status;
    end if;
  end if;

  return new;
end;
$$;

create trigger matches_participant_update_guard_trg
  before update on public.matches
  for each row
  execute function public.matches_participant_update_guard();
