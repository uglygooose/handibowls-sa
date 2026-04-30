-- Phase 12 / 12-4 / Migration 041 — t20_assessments.notes text → jsonb
--
-- Closes drift entry N8 (L152) — coach-categorised notes
-- (Strengths / Watch / Focus). The single text column is replaced
-- by a jsonb shape that holds three known keys + an optional
-- 'legacy' key for any pre-categorisation notes (none exist at
-- migration apply time per the cloud check; the key is reserved
-- for future imports / data migrations).
--
-- Schema decision rationale (from drift entry):
--   Option A (jsonb single column) — chosen here.
--     • Single SQL column; one SELECT round-trip
--     • Future categories are an additive change (extend the
--       CHECK constraint's key set)
--     • Empty categories are sparse JSON (don't pay for unused
--       columns)
--     • Trivial bridge for existing notes via 'legacy' key
--   Option B (three text columns: notes_strengths /
--     notes_watch / notes_focus) — rejected.
--     • Adds 3 columns at once + 3 nullable defaults; harder to
--       extend with a 4th category later
--     • Existing 'notes' column has to either drop (data loss
--       risk) or stay alongside (denormalised drift)
--
-- Pre-migration data check (Supabase MCP, 2026-04-30):
--   SELECT count(*), count(notes) FROM t20_assessments;
--   → 109 total, 0 with_notes
-- → no preserve-on-cast needed. The USING clause maps every
--   row's notes to NULL since no row has a string value to
--   wrap into 'legacy'.
--
-- New shape
--   notes  jsonb default null
--          NULL                              → no notes captured
--          {}                                → empty object (admin
--                                              cleared all categories)
--          { "strengths": "..." }            → category populated
--          { "strengths": "...", "watch": "..." }   → multiple
--          { "legacy": "..." }               → reserved for future
--                                              data-migration; the
--                                              UI renders a
--                                              read-only legacy
--                                              tile when present
--
-- CHECK constraint
--   notes is null OR (
--     jsonb_typeof(notes) = 'object'
--     AND notes ?| array['strengths', 'watch', 'focus', 'legacy']
--          = false  -- placeholder; actual logic below
--   )
--   Actual implementation: every key MUST be in the known set.
--   Use a subquery with jsonb_object_keys + array_agg to validate.
--   Postgres doesn't support a clean "all keys in" predicate;
--   we use a NOT EXISTS / subquery pattern in a CHECK function.
--
-- Why a function-backed CHECK instead of inline
--   CHECK clauses in Postgres can reference functions marked
--   IMMUTABLE; jsonb_object_keys is stable, but array_agg over
--   it isn't IMMUTABLE either. The cleanest pattern is a small
--   helper function returning boolean that the CHECK calls.

create or replace function public.t20_notes_keys_valid(notes jsonb)
returns boolean
language sql
immutable
as $$
  select
    notes is null
    or (
      jsonb_typeof(notes) = 'object'
      and not exists (
        select 1
          from jsonb_object_keys(notes) as k
         where k.k not in ('strengths', 'watch', 'focus', 'legacy')
      )
    )
$$;

comment on function public.t20_notes_keys_valid(jsonb) is
  'IMMUTABLE predicate for the t20_assessments.notes CHECK '
  'constraint. Returns true when notes is NULL or a jsonb object '
  'whose keys are a subset of {strengths, watch, focus, legacy}.';

-- Type change + USING clause. Every existing row maps to NULL
-- since no row has a string value at apply time (per the
-- pre-migration data check).
alter table public.t20_assessments
  alter column notes
    type jsonb
    using null::jsonb;

alter table public.t20_assessments
  alter column notes set default null;

-- Pin the shape via the helper function.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 't20_assessments_notes_shape'
       and conrelid = 'public.t20_assessments'::regclass
  ) then
    alter table public.t20_assessments
      add constraint t20_assessments_notes_shape
      check (public.t20_notes_keys_valid(notes));
  end if;
end$$;

comment on column public.t20_assessments.notes is
  'Categorised coach notes. NULL = none captured. jsonb object '
  'with optional keys: strengths (player''s strong points), '
  'watch (areas to monitor), focus (recommendations for the '
  'next training block), legacy (reserved for future imports of '
  'uncategorised notes from pre-12-4 systems). Constraint '
  't20_assessments_notes_shape pins the key set.';
