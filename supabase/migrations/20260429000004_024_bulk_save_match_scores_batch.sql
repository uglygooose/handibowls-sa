-- Phase 7c-iii / Migration 024 — bulk_save_match_scores_batch RPC
--
-- Atomic multi-row score save WITHOUT finalisation. Mirrors the
-- pre-rebuild RPC of the same name (deleted in Phase-0; recovered from
-- f87d8ef^:supabase/migrations/20260422_tournament_batch_rpcs.sql:135),
-- adapted to Phase-2 schema:
--   score_a / score_b → home_shots / away_shots
--
-- Partial saves: rows whose scores aren't a complete pair (either both
-- present or both missing) are skipped rather than rejected, matching
-- the singular-route client convention.
--
-- SECURITY INVOKER — RLS-respecting. Server-action layer
-- (lib/tournaments bulkSaveMatchScores in Phase 7c-iii) gates the
-- caller; this RPC re-checks auth.uid() != null as defence-in-depth.

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
  v_home int;
  v_away int;
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
    -- Action layer maps primitive home_shots/away_shots into the legacy
    -- score_a/score_b keys so this RPC has one canonical input shape.
    v_home := nullif(v_item->>'score_a', '')::int;
    v_away := nullif(v_item->>'score_b', '')::int;

    if v_match_id is null then
      raise exception 'Missing match_id in batch entry';
    end if;

    -- Skip rows without a full pair of scores (partial-save convention).
    if v_home is null or v_away is null then
      continue;
    end if;

    if v_home < 0 or v_away < 0 then
      raise exception 'Scores must be >= 0 (match %)', v_match_id;
    end if;

    update public.matches
       set home_shots = v_home,
           away_shots = v_away
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

grant execute on function public.bulk_save_match_scores_batch(uuid, jsonb) to authenticated;
