-- Phase 7c-iii / Migration 025 — admin_finalize_matches_batch RPC
--
-- Atomic multi-row admin finalisation. Re-introduces the deleted
-- pre-rebuild spec (f87d8ef^:20260422_tournament_batch_rpcs.sql:18)
-- adapted to Phase-2 schema:
--
--   team_a/b_id        → home_team_id / away_team_id
--   score_a/b          → home_shots / away_shots
--   confirmed_by_*     — gone (collapsed; per-side confirmation isn't
--                       tracked separately in this schema)
--   finalized_at,
--     admin_final_*    — collapsed into finalized_by_admin boolean
--   status 'COMPLETED' → 'completed' (current enum)
--   slot_*_source_*    — preserved (Phase-6b migration 022 added them)
--
-- For each match in the batch:
--   1. Validate scores (both present, non-negative, not tied — finalising
--      requires a clear winner).
--   2. Read home_team_id / away_team_id; require both set (BYE matches
--      shouldn't go through this path — they auto-advance via the
--      walkover lifecycle elsewhere).
--   3. Compute winner = home_team_id if score_a > score_b else away.
--   4. Update the row: scores, status='completed', finalized_by_admin=true,
--      winner_team_id=winner.
--   5. Winner propagation — for any downstream match whose
--      slot_a/b_source_match_id == this match AND
--      slot_a/b_source_type == 'WINNER_OF_MATCH', fill the corresponding
--      home/away_team_id and switch source_type to 'TEAM'.
--
-- After the batch, promote any OPEN matches whose home + away are now
-- both filled to SCHEDULED. (No 'open' value in the current match_status
-- enum — the schema's "scheduled" already implies "scheduled and ready
-- to be played"; the legacy "OPEN→SCHEDULED" transition collapses to
-- "leave as scheduled" today, but the post-batch update is still useful
-- if a future schema adds an explicit OPEN state.)
--
-- SECURITY INVOKER — RLS-respecting; server-action layer gates the
-- tournament-owner check.

create or replace function public.admin_finalize_matches_batch(
  p_tournament_id uuid,
  p_matches jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count int := 0;
  v_item jsonb;
  v_match_id uuid;
  v_home int;
  v_away int;
  v_home_team uuid;
  v_away_team uuid;
  v_winner uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_tournament_id is null then
    raise exception 'Missing tournament_id';
  end if;
  if p_matches is null or jsonb_typeof(p_matches) <> 'array' then
    raise exception 'p_matches must be a JSON array';
  end if;

  for v_item in select * from jsonb_array_elements(p_matches)
  loop
    v_match_id := (v_item->>'match_id')::uuid;
    v_home := (v_item->>'score_a')::int;
    v_away := (v_item->>'score_b')::int;

    if v_match_id is null then
      raise exception 'Missing match_id in batch entry';
    end if;
    if v_home is null or v_away is null then
      raise exception 'Missing scores for match %', v_match_id;
    end if;
    if v_home < 0 or v_away < 0 then
      raise exception 'Scores must be >= 0 (match %)', v_match_id;
    end if;
    if v_home = v_away then
      raise exception 'Scores tied for match % — a winner is required to finalise', v_match_id;
    end if;

    select home_team_id, away_team_id
      into v_home_team, v_away_team
      from public.matches
     where id = v_match_id
       and tournament_id = p_tournament_id;

    if not found then
      raise exception 'Match % not found in tournament %', v_match_id, p_tournament_id;
    end if;
    if v_home_team is null or v_away_team is null then
      raise exception 'Match %: teams are not set', v_match_id;
    end if;

    v_winner := case when v_home > v_away then v_home_team else v_away_team end;

    update public.matches
       set home_shots = v_home,
           away_shots = v_away,
           status = 'completed'::match_status,
           finalized_by_admin = true,
           winner_team_id = v_winner
     where id = v_match_id;

    -- Winner propagation — slot A.
    update public.matches
       set home_team_id = v_winner,
           slot_a_source_type = 'TEAM',
           slot_a_source_match_id = null
     where tournament_id = p_tournament_id
       and slot_a_source_match_id = v_match_id
       and slot_a_source_type = 'WINNER_OF_MATCH';

    -- Winner propagation — slot B.
    update public.matches
       set away_team_id = v_winner,
           slot_b_source_type = 'TEAM',
           slot_b_source_match_id = null
     where tournament_id = p_tournament_id
       and slot_b_source_match_id = v_match_id
       and slot_b_source_type = 'WINNER_OF_MATCH';

    v_count := v_count + 1;
  end loop;

  -- Promote any matches that now have both teams filled. Uses
  -- 'scheduled' since the current enum has no separate 'open' value.
  -- Effectively a no-op today (rows are scheduled by save_round_fixtures_batch
  -- before they reach this RPC); future-proof for an OPEN state revival.
  update public.matches
     set status = 'scheduled'::match_status
   where tournament_id = p_tournament_id
     and status = 'scheduled'::match_status
     and home_team_id is not null
     and away_team_id is not null;

  return jsonb_build_object(
    'ok', true,
    'updated_count', v_count,
    'tournament_id', p_tournament_id
  );
end;
$$;

grant execute on function public.admin_finalize_matches_batch(uuid, jsonb) to authenticated;
