-- Phase 8d follow-up / Migration 029 — matches.submitted_by_team_id
-- + extended participant-update guard
--
-- Phase 8d Diagnostic 14 (manual QA): the captain who submitted scores
-- could ALSO confirm them, because the post-submit UI fell back to
-- rendering OpponentConfirmationCard for both teams in the match. The
-- state machine in 028 is correct; the bug is upstream UX. Surfacing
-- the right component requires knowing which team submitted — schema
-- has no audit row for that yet.
--
-- This migration adds `matches.submitted_by_team_id` so the player
-- scorecard can branch:
--
--   • caller's team_id == submitted_by_team_id  → passive
--     "Awaiting opponent confirmation" banner.
--   • caller's team_id != submitted_by_team_id  → active
--     "Confirm result" card (the OpponentConfirmationCard).
--
-- Canonical owner: the action layer (`submitMatch`) writes the value
-- on the first submission; the trigger layer enforces immutability +
-- caller-membership. Mirrors the migration-028 audit-timestamp
-- pattern: action seeds, trigger backstops.
--
-- Three contracts pinned by this migration:
--
--   (1) Column + FK + CHECK
--       New column NULLABLE (NULL = no captain has submitted yet, OR
--       legacy row from before the migration). FK on delete set null
--       — matches the surrounding home/away/winner_team_id
--       conventions. CHECK constraint guarantees the value is one of
--       the match's two teams (or null).
--
--   (2) Trigger — extended matches_participant_update_guard
--       Two new rules added to the existing function:
--         • Freeze: if OLD.submitted_by_team_id is not null, restore
--           OLD silently (mirrors captain_submitted_at). Once set, the
--           field is immutable for participants.
--         • First-submission gate: when submission_status transitions
--           pending → captain_submitted, NEW.submitted_by_team_id MUST
--           be one of NEW.home_team_id / NEW.away_team_id AND the
--           writing user (auth.uid()) MUST be a member of that team.
--           Stops a hostile or buggy client from claiming the
--           opponent's identity.
--       Admin paths (current_role in admin/super_admin/null) skip the
--       guard exactly as before — admin overrides via verifyMatch may
--       legitimately leave submitted_by_team_id null when the captains
--       never submitted (dispute / abandoned-match path).
--
--   (3) No backfill, no index
--       Dev-only data at this stage. Existing rows (incl. any in
--       captain_submitted / opponent_confirmed / completed states) get
--       NULL — there's no audit signal in the existing schema to
--       derive the right team_id from, and a wrong guess would change
--       UI behaviour. The component renders a graceful fallback when
--       NULL: passive banner for both teams (legacy no-op). New rows
--       written after this migration get the correct value.
--
--       No index — the column is read alongside the match row for
--       branching UI; no filter / aggregate query uses it. Matches the
--       precedent of `winner_team_id`, which similarly has no index.
--       If a future feature needs "matches submitted by team X" as a
--       filter, add the index then.

-- 1. Column + FK + CHECK -------------------------------------------------
alter table public.matches
  add column submitted_by_team_id uuid
    references public.tournament_teams(id)
    on delete set null;

alter table public.matches
  add constraint matches_submitter_is_participant check (
    submitted_by_team_id is null
    or submitted_by_team_id = home_team_id
    or submitted_by_team_id = away_team_id
  );

-- 2. Extended participant-update guard ----------------------------------
-- Replaces the function from migration 028. Re-uses the existing
-- trigger binding (matches_participant_update_guard_trg) — no need to
-- drop/recreate the trigger itself, only the function body.
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
  -- writes to admin-derived fields (incl. dispute-path verifyMatch
  -- leaving submitted_by_team_id null when captains never submitted).
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

  -- ---- submitted_by_team_id: freeze + first-submission gate ---------
  -- Mirror the audit-timestamp freeze. Once a submitter has been
  -- recorded, the value is immutable for participants — confirmMatch /
  -- re-submit must NOT mutate it. Action layer can pass it again
  -- without harm (silently ignored).
  if old.submitted_by_team_id is not null then
    new.submitted_by_team_id := old.submitted_by_team_id;
  else
    -- First submission: validate the writer's claim.
    if new.submitted_by_team_id is not null then
      if new.submitted_by_team_id is distinct from new.home_team_id
         and new.submitted_by_team_id is distinct from new.away_team_id then
        raise exception 'matches_participant_update_guard: submitted_by_team_id must be one of the match teams';
      end if;
      if not public.is_team_member(new.submitted_by_team_id, auth.uid()) then
        raise exception 'matches_participant_update_guard: caller is not a member of submitted_by_team_id';
      end if;
    end if;
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

    -- First-submission requires submitted_by_team_id be set. Pin the
    -- contract at the DB level so a future buggy action can't slip a
    -- captain_submitted row through with a null submitter.
    if old.submission_status = 'pending'
       and new.submission_status = 'captain_submitted'
       and new.submitted_by_team_id is null
    then
      raise exception 'matches_participant_update_guard: submitted_by_team_id required on first submission';
    end if;
  end if;

  return new;
end;
$$;
