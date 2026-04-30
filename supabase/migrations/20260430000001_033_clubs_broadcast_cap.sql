-- Phase 11 / Migration 033 — clubs.daily_broadcast_cap
--
-- Plan §14 step 6 ("per-club daily broadcast cap, default 2,
-- configurable"). Adds a non-null `daily_broadcast_cap int` column
-- to `clubs` so the Phase 11 send pipeline can rate-limit broadcasts
-- per club per day. Cap of 2 mirrors the plan default; clubs that
-- need more can lift it via a super-admin update once a tooling path
-- lands (Phase 12 polish, not in scope here).
--
-- Why a column on `clubs` rather than a separate `club_settings` table
--
--   v1 has exactly one tunable comms knob — the daily cap. Standing
--   up a settings table for one column would be premature
--   abstraction (handibowls-standards: "no speculative code").
--   When the second knob arrives (per-club sender override, quiet
--   hours, retention windows, …) we extract a `club_settings` table
--   in that phase's migration and migrate this column across in the
--   same commit.
--
-- Why a CHECK constraint
--
--   The cap must be non-negative. Zero is a meaningful value —
--   "broadcasts disabled for this club" — so the CHECK is `>= 0`,
--   not `> 0`. Negative values would silently disable the cap on
--   any naive `count() < cap` comparison, which is the wrong
--   behaviour for an unsafe-default field.
--
-- Why default 2
--
--   Plan §14 step 6 locks the default. Clubs piloting in Phase 11
--   QA can broadcast twice a day without a super-admin tweak. The
--   number was picked to keep player inboxes manageable while not
--   blocking time-sensitive comms (e.g., morning roll-up + afternoon
--   tournament reminder).
--
-- Enforcement layer
--
--   This migration only stores the value. The cap is enforced by
--   the Phase 11 `send_message(message_id)` SECURITY DEFINER RPC
--   (lands in 11-2) which atomically counts today's queued/sent
--   messages for the club and rejects if `count >= cap`. App-layer
--   pre-checks in the compose UI surface the same limit as a
--   warning banner before submit.
--
-- Out of scope
--
--   • The `send_message` RPC itself — lands in 11-2 alongside the
--     fan-out edge function.
--   • Super-admin UI to edit the cap — Phase 12 polish item.
--   • Time-window variants (per-hour, weekly) — not in v1; revisit
--     if real-world usage proves the daily granularity wrong.

alter table public.clubs
  add column daily_broadcast_cap int not null default 2;

alter table public.clubs
  add constraint clubs_daily_broadcast_cap_non_negative
  check (daily_broadcast_cap >= 0);

comment on column public.clubs.daily_broadcast_cap is
  'Maximum number of broadcast messages this club may queue or send '
  'per UTC day. Enforced atomically by the send_message(message_id) '
  'RPC (Phase 11). Zero disables broadcasts entirely. Default 2 per '
  'plan §14 step 6; super-admin updates lift it.';
