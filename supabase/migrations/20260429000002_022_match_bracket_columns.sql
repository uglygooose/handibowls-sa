-- Phase 6b / Migration 022 — bracket-tracking columns on `matches`
--
-- Additive only. Adds the six columns the Phase 6 tournament-engine
-- primitives (`completion.ts`, `rounds.ts`, `BracketTree.tsx`,
-- `brackets/matchHelpers.ts`) read/write — column-named for the keep-list
-- mapping in HANDIBOWLS_REBUILD_PLAN.md §18 + §9.
--
-- Why these columns and not enum extensions:
--   • match_no, finalized_by_admin — round-internal sequencing + admin
--     override flag. Pure-domain concepts; no DB enum needed.
--   • slot_{a,b}_source_type, slot_{a,b}_source_match_id — feeder
--     semantics for knockout brackets, especially play-in rounds where
--     a round-2 slot can be filled by either (a) a BYE-direct team
--     (TEAM) or (b) the winner of a play-in match (WINNER_OF_MATCH).
--     Without these the play-in encoding for non-power-of-2 entry
--     counts breaks. Stored as TEXT with a CHECK constraint instead of
--     a real enum: keeps the primitives' uppercase compares working
--     ("TEAM" / "WINNER_OF_MATCH" / "BYE") without an adapter case-map
--     for the slot-source values themselves. Status enum case-map stays
--     at the adapter boundary per the 6a drift item.
--
-- Status enum unchanged. OPEN / FINAL / IN_PLAY are pure-domain values
-- the adapter computes from (status, finalized_by_admin) — they don't
-- need DB enum extension.
--
-- Backfill: dev cloud `matches` is currently empty. New rows from Phase 6
-- onward populate match_no + slot_*_source_*. finalized_by_admin defaults
-- to false on every row.

alter table public.matches
  add column match_no integer,
  add column finalized_by_admin boolean not null default false,
  add column slot_a_source_type text,
  add column slot_a_source_match_id uuid references public.matches(id) on delete set null,
  add column slot_b_source_type text,
  add column slot_b_source_match_id uuid references public.matches(id) on delete set null;

-- Domain constraints — enforce the slot-source value set without using a
-- real enum (so primitives can keep their uppercase string compares).
alter table public.matches
  add constraint matches_slot_a_source_type_valid check (
    slot_a_source_type is null
    or slot_a_source_type in ('TEAM', 'WINNER_OF_MATCH', 'BYE')
  ),
  add constraint matches_slot_b_source_type_valid check (
    slot_b_source_type is null
    or slot_b_source_type in ('TEAM', 'WINNER_OF_MATCH', 'BYE')
  ),
  -- Conditional: WINNER_OF_MATCH must point at a feeder match. TEAM and
  -- BYE rows leave slot_*_source_match_id NULL.
  add constraint matches_slot_a_winner_has_source check (
    slot_a_source_type is distinct from 'WINNER_OF_MATCH'
    or slot_a_source_match_id is not null
  ),
  add constraint matches_slot_b_winner_has_source check (
    slot_b_source_type is distinct from 'WINNER_OF_MATCH'
    or slot_b_source_match_id is not null
  );

-- Partial indexes on the feeder columns. The bracket-advance + bracket-
-- tree-rendering paths look up "which round-N matches feed from match X"
-- via these columns. Indexed only on populated rows since most matches
-- (round-1 TEAM-vs-TEAM and BYE) leave them null.
create index matches_slot_a_source_match_id_idx
  on public.matches (slot_a_source_match_id)
  where slot_a_source_match_id is not null;

create index matches_slot_b_source_match_id_idx
  on public.matches (slot_b_source_match_id)
  where slot_b_source_match_id is not null;
