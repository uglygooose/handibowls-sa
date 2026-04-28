-- Phase 6a / Migration 021 — tournaments.seeding_method
--
-- Adds the BSA seeding method enum + column (Q from Phase 6 prompt:
-- random / seeded / sectional). Default 'random' matches the pre-rebuild
-- behaviour where most clubs do a shuffle-and-pair draw. Phase 6 server
-- actions in `lib/tournaments/seeding.ts` consume this.
--
-- Additive only — does not touch any other column or row.

create type seeding_method as enum (
  'random',
  'seeded',
  'sectional'
);

alter table public.tournaments
  add column seeding_method seeding_method not null default 'random';
