-- Phase 7c-ii / Migration 023 — save_round_fixtures_batch RPC
--
-- Atomic batch fixture writer. Originally shipped in the pre-rebuild
-- migration 20260422_tournament_batch_rpcs.sql (deleted in Phase-0
-- teardown commit f87d8ef); this re-introduces it adapted to the
-- Phase-2 schema.
--
-- Column-rename mapping vs. the deleted spec:
--   team_a_id        → home_team_id
--   team_b_id        → away_team_id
--   score_a/score_b  → home_shots/away_shots (int, default 0)
--   round_no         → round
--   confirmed_by_*   — gone (no per-side confirmation tracked today)
--   submitted_by_*   — gone
--   finalized_at     — collapsed into finalized_by_admin boolean
--
-- Status-enum mapping:
--   "BYE"            → 'walkover' (current match_status enum value)
--   "SCHEDULED"      → 'scheduled'
--
-- SECURITY INVOKER: writes go through the caller's RLS. Server-side
-- action layer (Phase 6d / 7c-ii) gates the call by tournament-owner;
-- this RPC is defence-in-depth only and re-checks auth.uid() != null.
--
-- Pair-uniqueness — a team can appear at most once across the round
-- (either home or away side). Surfaces malformed batches before any
-- row is written, matching the old behaviour.

create or replace function public.save_round_fixtures_batch(
  p_tournament_id uuid,
  p_round int,
  p_fixtures jsonb
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
  v_home uuid;
  v_away uuid;
  v_status match_status;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_tournament_id is null then
    raise exception 'Missing tournament_id';
  end if;
  if p_round is null then
    raise exception 'Missing round';
  end if;
  if p_fixtures is null or jsonb_typeof(p_fixtures) <> 'array' then
    raise exception 'p_fixtures must be a JSON array';
  end if;

  -- Pair-uniqueness across the batch: a team_id (either side) appearing
  -- twice signals a client bug. Catch before any UPDATE so we don't
  -- half-apply a malformed fixture.
  if exists (
    select 1
      from (
        select team_id
          from (
            select (elem->>'home_team_id')::uuid as team_id
              from jsonb_array_elements(p_fixtures) elem
             where nullif(elem->>'home_team_id', '') is not null
            union all
            select (elem->>'away_team_id')::uuid as team_id
              from jsonb_array_elements(p_fixtures) elem
             where nullif(elem->>'away_team_id', '') is not null
          ) t
       group by team_id
      having count(*) > 1
      ) dup
  ) then
    raise exception 'Each team can only appear once in the round';
  end if;

  for v_item in select * from jsonb_array_elements(p_fixtures)
  loop
    v_match_id := (v_item->>'match_id')::uuid;
    v_home := nullif(v_item->>'home_team_id', '')::uuid;
    v_away := nullif(v_item->>'away_team_id', '')::uuid;

    if v_match_id is null then
      raise exception 'Missing match_id in fixture entry';
    end if;
    if v_home is null then
      raise exception 'Match % must have home_team_id set', v_match_id;
    end if;
    if v_home = v_away then
      raise exception 'Match %: a team cannot play itself', v_match_id;
    end if;

    -- New schema's enum has no explicit 'bye' — walkover doubles as
    -- the "no-opponent advance" status. Adapter case-mapping then
    -- reads it back as primitive 'BYE'.
    v_status := case
      when v_away is null then 'walkover'::match_status
      else 'scheduled'::match_status
    end;

    update public.matches
       set home_team_id = v_home,
           away_team_id = v_away,
           status = v_status,
           home_shots = 0,
           away_shots = 0,
           home_ends_won = 0,
           away_ends_won = 0,
           finalized_by_admin = false,
           winner_team_id = null
     where id = v_match_id
       and tournament_id = p_tournament_id
       and round = p_round;

    if not found then
      raise exception 'Match % not found in tournament % round %', v_match_id, p_tournament_id, p_round;
    end if;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'updated_count', v_count);
end;
$$;

grant execute on function public.save_round_fixtures_batch(uuid, int, jsonb) to authenticated;
