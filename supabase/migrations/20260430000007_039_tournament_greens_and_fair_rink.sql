-- Phase 12 / 12-2 / Migration 039 — tournament_greens join table + tournaments.fair_rink
--
-- Closes drift entries L174 (tournament ↔ greens link missing) +
-- L175 (tournaments.fair_rink column missing), consolidated into
-- the "Phase 7b cross-cutting tournament migration" entry at Phase
-- 12 triage. Both fields ship from the Phase 7b create form's UI
-- but were dropped on submit because the schema didn't support
-- them. This migration lands the schema; the form wire follows in
-- a subsequent commit.
--
-- Two pieces:
--
--   1. tournaments.fair_rink boolean not null default true
--      The Fair-Rink toggle from the create form. `true` matches
--      the form's default and the helper text recommendation
--      (spread teams evenly, bias against repeats). Existing rows
--      backfill to true via the default.
--
--   2. tournament_greens (tournament_id, green_id) — join table
--      with composite PK + FKs. A tournament's selected greens
--      scope which surfaces the rink-fairness algorithm picks
--      from. ON DELETE CASCADE on tournament_id (tournament gone
--      → links gone). ON DELETE RESTRICT on green_id (deleting a
--      green a tournament uses requires explicit cleanup —
--      protects historical tournament records from silent
--      drop-on-cascade).
--
-- RLS — mirrors tournaments
--
--   • super_admin       → all
--   • club_admin (host) → all where the parent tournament's
--                          host_club_id is in current_club_ids
--   • everyone else     → read where the tournament itself is
--                          readable to them (member or participant)
--
-- The host_club_id check is satisfied via a JOIN — there's no
-- denormalised club_id on tournament_greens. Keeps the schema
-- skinny; RLS performance is acceptable because tournament_greens
-- queries are always paired with the parent tournament fetch
-- in the existing _data fetchers.

-- ---------------------------------------------------------------------
-- 1. tournaments.fair_rink
-- ---------------------------------------------------------------------

alter table public.tournaments
  add column if not exists fair_rink boolean not null default true;

comment on column public.tournaments.fair_rink is
  'Whether the rink fairness algorithm spreads teams evenly across '
  'rinks, biasing against repeats. Default true. Set per-tournament '
  'on the create form.';

-- ---------------------------------------------------------------------
-- 2. tournament_greens join table
-- ---------------------------------------------------------------------

create table if not exists public.tournament_greens (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  green_id uuid not null references public.greens(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (tournament_id, green_id)
);

create index if not exists tournament_greens_tournament_idx
  on public.tournament_greens (tournament_id);
create index if not exists tournament_greens_green_idx
  on public.tournament_greens (green_id);

comment on table public.tournament_greens is
  'Many-to-many link from tournaments to the greens they may use. '
  'Scopes the rink fairness algorithm''s candidate pool. Composite '
  'PK on (tournament_id, green_id) prevents duplicate links.';

alter table public.tournament_greens enable row level security;

-- super_admin: all
create policy tournament_greens_super_admin_all on public.tournament_greens
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

-- club_admin (host of the parent tournament): rw
create policy tournament_greens_host_club_admin_rw on public.tournament_greens
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and exists (
      select 1 from public.tournaments t
       where t.id = tournament_greens.tournament_id
         and t.host_club_id = any(public.current_club_ids())
    )
  )
  with check (
    public.current_role() = 'club_admin'
    and exists (
      select 1 from public.tournaments t
       where t.id = tournament_greens.tournament_id
         and t.host_club_id = any(public.current_club_ids())
    )
  );

-- read: anyone who can read the parent tournament (covers members
-- of the host club + participants in the tournament)
create policy tournament_greens_member_read on public.tournament_greens
  for select to authenticated
  using (
    exists (
      select 1 from public.tournaments t
       where t.id = tournament_greens.tournament_id
         and (
           t.host_club_id = any(public.current_club_ids())
           or public.is_tournament_participant(t.id, auth.uid())
         )
    )
  );
