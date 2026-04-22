-- Phase 7 — N+1 batch endpoints for tournament admin actions.
--
-- Three PL/pgSQL functions that atomically apply a batch of match mutations.
-- SECURITY INVOKER (the default): each function runs under the caller's auth,
-- so writes go through the existing RLS policies on public.matches (which
-- already permit admin writes via the club-admin / super-admin model).
--
-- The TypeScript routes in app/api/tournaments/matches/*/batch/ perform the
-- profile-based admin gate and tournament-scope check before calling these
-- functions — matching the belt-and-braces pattern of the singular routes.

-- 1) Admin-finalise a batch of matches in one tournament.
--    Validates every entry; on any error the whole batch rolls back.
--    Also propagates the winner forward into any downstream matches that
--    reference this match via slot_a_source_match_id / slot_b_source_match_id
--    with source_type = 'WINNER_OF_MATCH', then promotes OPEN matches whose
--    slots are now filled to SCHEDULED.
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
  v_now timestamptz := now();
  v_uid uuid := auth.uid();
  v_count int := 0;
  v_item jsonb;
  v_match_id uuid;
  v_score_a int;
  v_score_b int;
  v_team_a uuid;
  v_team_b uuid;
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
    v_score_a := (v_item->>'score_a')::int;
    v_score_b := (v_item->>'score_b')::int;

    if v_match_id is null then
      raise exception 'Missing match_id in batch entry';
    end if;
    if v_score_a is null or v_score_b is null then
      raise exception 'Missing scores for match %', v_match_id;
    end if;
    if v_score_a < 0 or v_score_b < 0 then
      raise exception 'Scores must be >= 0 (match %)', v_match_id;
    end if;
    if v_score_a = v_score_b then
      raise exception 'Scores are tied for match % — a winner is required to finalise', v_match_id;
    end if;

    select team_a_id, team_b_id
      into v_team_a, v_team_b
      from public.matches
     where id = v_match_id
       and tournament_id = p_tournament_id;

    if not found then
      raise exception 'Match % not found in tournament %', v_match_id, p_tournament_id;
    end if;
    if v_team_a is null or v_team_b is null then
      raise exception 'Match %: teams are not set', v_match_id;
    end if;

    v_winner := case when v_score_a > v_score_b then v_team_a else v_team_b end;

    update public.matches
       set score_a = v_score_a,
           score_b = v_score_b,
           status = 'COMPLETED',
           confirmed_by_a = true,
           confirmed_by_b = true,
           finalized_by_admin = true,
           finalized_at = v_now,
           admin_final_by = v_uid,
           admin_final_at = v_now,
           winner_team_id = v_winner
     where id = v_match_id;

    -- Winner propagation: fill downstream slot A's that were waiting on us.
    update public.matches
       set team_a_id = v_winner,
           slot_a_source_type = 'TEAM',
           slot_a_source_match_id = null
     where tournament_id = p_tournament_id
       and slot_a_source_match_id = v_match_id
       and slot_a_source_type = 'WINNER_OF_MATCH';

    update public.matches
       set team_b_id = v_winner,
           slot_b_source_type = 'TEAM',
           slot_b_source_match_id = null
     where tournament_id = p_tournament_id
       and slot_b_source_match_id = v_match_id
       and slot_b_source_type = 'WINNER_OF_MATCH';

    v_count := v_count + 1;
  end loop;

  -- Any OPEN match whose slots have been filled becomes SCHEDULED.
  update public.matches
     set status = 'SCHEDULED'
   where tournament_id = p_tournament_id
     and status = 'OPEN'
     and team_a_id is not null
     and team_b_id is not null;

  return jsonb_build_object(
    'ok', true,
    'updated_count', v_count,
    'tournament_id', p_tournament_id
  );
end;
$$;

-- 2) Bulk save score_a/score_b without finalising. Partial saves allowed:
--    entries with null/missing scores are skipped rather than rejected, so the
--    client can pass the full round and let rows with empty inputs pass through.
create or replace function public.bulk_save_match_scores_batch(
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
  v_score_a int;
  v_score_b int;
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
    v_score_a := nullif(v_item->>'score_a', '')::int;
    v_score_b := nullif(v_item->>'score_b', '')::int;

    if v_match_id is null then
      raise exception 'Missing match_id in batch entry';
    end if;

    -- Skip rows without a full pair of scores (mirrors singular client logic).
    if v_score_a is null or v_score_b is null then
      continue;
    end if;

    if v_score_a < 0 or v_score_b < 0 then
      raise exception 'Scores must be >= 0 (match %)', v_match_id;
    end if;

    update public.matches
       set score_a = v_score_a,
           score_b = v_score_b
     where id = v_match_id
       and tournament_id = p_tournament_id;

    if not found then
      raise exception 'Match % not found in tournament %', v_match_id, p_tournament_id;
    end if;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'updated_count', v_count);
end;
$$;

-- 3) Assign team_a_id/team_b_id for a batch of fixtures in a specific round.
--    Resets all score/confirmation/finalisation state on each updated row,
--    so rewriting fixtures doesn't leave stale scores or winners behind.
create or replace function public.save_round_fixtures_batch(
  p_tournament_id uuid,
  p_round_no int,
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
  v_team_a uuid;
  v_team_b uuid;
  v_status text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_tournament_id is null then
    raise exception 'Missing tournament_id';
  end if;
  if p_round_no is null then
    raise exception 'Missing round_no';
  end if;
  if p_fixtures is null or jsonb_typeof(p_fixtures) <> 'array' then
    raise exception 'p_fixtures must be a JSON array';
  end if;

  -- Pair-uniqueness: a team can appear at most once across the whole batch
  -- (either side). Catches client omissions before any row is written.
  if exists (
    select 1
      from (
        select team_id
          from (
            select (elem->>'team_a_id')::uuid as team_id
              from jsonb_array_elements(p_fixtures) elem
             where nullif(elem->>'team_a_id', '') is not null
            union all
            select (elem->>'team_b_id')::uuid as team_id
              from jsonb_array_elements(p_fixtures) elem
             where nullif(elem->>'team_b_id', '') is not null
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
    v_team_a := nullif(v_item->>'team_a_id', '')::uuid;
    v_team_b := nullif(v_item->>'team_b_id', '')::uuid;

    if v_match_id is null then
      raise exception 'Missing match_id in fixture entry';
    end if;
    if v_team_a is null then
      raise exception 'Match % must have team_a_id set', v_match_id;
    end if;
    if v_team_a = v_team_b then
      raise exception 'Match %: a team cannot play itself', v_match_id;
    end if;

    v_status := case when v_team_b is null then 'BYE' else 'SCHEDULED' end;

    update public.matches
       set team_a_id = v_team_a,
           team_b_id = v_team_b,
           status = v_status,
           score_a = null,
           score_b = null,
           confirmed_by_a = false,
           confirmed_by_b = false,
           finalized_by_admin = false,
           finalized_at = null,
           admin_final_by = null,
           admin_final_at = null,
           submitted_by_player_id = null,
           submitted_at = null,
           winner_team_id = null
     where id = v_match_id
       and tournament_id = p_tournament_id
       and round_no = p_round_no;

    if not found then
      raise exception 'Match % not found in tournament % round %', v_match_id, p_tournament_id, p_round_no;
    end if;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'updated_count', v_count);
end;
$$;

-- Execute grants. Postgres defaults give EXECUTE to PUBLIC on new functions
-- in the public schema; being explicit makes the intent legible and guards
-- against projects that have revoked the default.
grant execute on function public.admin_finalize_matches_batch(uuid, jsonb) to authenticated;
grant execute on function public.bulk_save_match_scores_batch(uuid, jsonb) to authenticated;
grant execute on function public.save_round_fixtures_batch(uuid, int, jsonb) to authenticated;
