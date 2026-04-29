-- Phase 10 / Migration 032 — Twenty 20 distance-bucket column
--
-- Plan §13 step 0 ("016_t20_distance_bucket.sql" in plan numbering;
-- our cumulative sequence puts it at 032). Adds a nullable
-- `distance_bucket text` column to `t20_deliveries`, CHECK-constrained
-- to ('<10cm','10-30cm','30cm+') or NULL. Backwards-compatible with
-- v1 — existing rows keep `distance_bucket = NULL` and grading is
-- unchanged.
--
-- Why a column on the deliveries table rather than a payload key on
-- `outcome` jsonb
--
--   The bucket is a structured analytics dimension — we'll group by
--   it on results-view charts ("how often does this player land
--   within 10cm vs 30cm+?") and on per-club aggregate reports
--   eventually. Storing it as a first-class column lets PostgreSQL
--   index it and lets PostgREST `eq()`/`in()` filter it cleanly.
--   Putting it inside the `outcome` jsonb would force every consumer
--   to use jsonb operators and we'd lose the CHECK constraint's
--   shape guarantee.
--
-- Why nullable + no default
--
--   v1 capture UIs (this phase's wizard skeleton) don't surface the
--   bucket selector. The column lands so v2 rubric work (plan §13
--   step 6) can flip a switch on the rubric JSON
--   (`distanceBucket: { required: true }`) and the capture UI starts
--   asking — without a schema migration at v2 activation. Existing
--   v1 rows must remain valid, so the column is nullable.
--
-- Out of scope
--
--   • The capture UI's bucket selector — Claude Design follow-up
--     after Phase 10 closes.
--   • The results-view bucket histogram — same Claude Design
--     follow-up.
--   • Backfill — there's no real data to backfill in v1.

alter table public.t20_deliveries
  add column distance_bucket text;

alter table public.t20_deliveries
  add constraint t20_deliveries_distance_bucket_allowed
  check (distance_bucket is null or distance_bucket in ('<10cm', '10-30cm', '30cm+'));

-- Partial index — most rows in v1 will be NULL, so a partial index on
-- non-null buckets keeps the index small while still serving the
-- analytics queries (results-view charts, per-club aggregate reports).
create index t20_deliveries_distance_bucket_idx
  on public.t20_deliveries (distance_bucket)
  where distance_bucket is not null;
