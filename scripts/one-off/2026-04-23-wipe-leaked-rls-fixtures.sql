-- 2026-04-23 — wipe leaked RLS-test fixtures
--
-- Phase 4 prep. The RLS suite (tests/rls/helpers.ts) seeds clubs with slug
-- prefix 'test-<uuid>' but has no afterAll teardown, so rows leaked across
-- runs and blocked an ordinary `delete from clubs where slug like 'test-%'`
-- on 2026-04-23 with FK violations against 6 child tables + transitive
-- descendants.
--
-- This file is an audit trail of the one-off cleanup executed against the
-- local dev database. Not a migration. Not re-runnable (the rows it targets
-- no longer exist). The RLS helpers teardown fix is tracked in DRIFT_LOG.md
-- under Phase 13.
--
-- Executed against: postgresql://postgres:postgres@127.0.0.1:54322/postgres
-- Scope: public schema, test-prefixed clubs only. Demo Bowls Club preserved.

begin;

-- Audit before
select 'clubs' as tbl, count(*) from clubs where slug like 'test-%'
union all select 'club_memberships', count(*) from club_memberships cm
  join clubs c on c.id = cm.club_id where c.slug like 'test-%'
union all select 'club_admin_assignments', count(*) from club_admin_assignments caa
  join clubs c on c.id = caa.club_id where c.slug like 'test-%'
union all select 't20_assessments', count(*) from t20_assessments ta
  join clubs c on c.id = ta.club_id where c.slug like 'test-%'
union all select 'tournaments', count(*) from tournaments t
  join clubs c on c.id = t.host_club_id where c.slug like 'test-%'
union all select 'bookings', count(*) from bookings b
  join clubs c on c.id = b.club_id where c.slug like 'test-%'
union all select 'greens', count(*) from greens g
  join clubs c on c.id = g.club_id where c.slug like 'test-%';

-- Deletion order: leaves inward. FK graph (to depth 4) confirmed via
-- information_schema.referential_constraints before execution.
--
-- Layer L4/L3 (leaf-most descendants)
delete from match_ends
  where match_id in (
    select m.id from matches m
    join tournaments t on t.id = m.tournament_id
    join clubs c on c.id = t.host_club_id
    where c.slug like 'test-%'
  );

delete from tournament_team_members
  where team_id in (
    select tt.id from tournament_teams tt
    join tournaments t on t.id = tt.tournament_id
    join clubs c on c.id = t.host_club_id
    where c.slug like 'test-%'
  );

delete from message_recipients
  where message_id in (
    select m.id from messages m
    join clubs c on c.id = m.club_id
    where c.slug like 'test-%'
  );

delete from t20_deliveries
  where assessment_id in (
    select ta.id from t20_assessments ta
    join clubs c on c.id = ta.club_id
    where c.slug like 'test-%'
  );

-- Layer L2: bookings references matches AND rinks AND clubs directly.
-- Wipe bookings first so matches/rinks can go.
delete from bookings
  where club_id in (select id from clubs where slug like 'test-%');

delete from matches
  where tournament_id in (
    select t.id from tournaments t
    join clubs c on c.id = t.host_club_id
    where c.slug like 'test-%'
  );

delete from tournament_entries
  where club_id in (select id from clubs where slug like 'test-%');

delete from tournament_teams
  where tournament_id in (
    select t.id from tournaments t
    join clubs c on c.id = t.host_club_id
    where c.slug like 'test-%'
  );

delete from rinks
  where green_id in (
    select g.id from greens g
    join clubs c on c.id = g.club_id
    where c.slug like 'test-%'
  );

delete from booking_windows
  where club_id in (select id from clubs where slug like 'test-%');

-- Layer L1: direct children of clubs
delete from club_memberships
  where club_id in (select id from clubs where slug like 'test-%');

delete from club_admin_assignments
  where club_id in (select id from clubs where slug like 'test-%');

delete from t20_assessments
  where club_id in (select id from clubs where slug like 'test-%');

delete from tournaments
  where host_club_id in (select id from clubs where slug like 'test-%');

delete from greens
  where club_id in (select id from clubs where slug like 'test-%');

delete from invites
  where club_id in (select id from clubs where slug like 'test-%');

delete from messages
  where club_id in (select id from clubs where slug like 'test-%');

delete from notifications
  where club_id in (select id from clubs where slug like 'test-%');

-- Finally the clubs themselves
delete from clubs where slug like 'test-%';

-- Audit after
select count(*) as remaining_test_clubs from clubs where slug like 'test-%';
select count(*) as demo_club_survives from clubs where name = 'Demo Bowls Club';

commit;
