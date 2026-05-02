-- Phase 13 / 13-2b / Batch F1 — Migration 044
-- POPIA RLS soft-delete filter + anonymise-not-delete pattern.
--
-- Updates the two cross-user SELECT policies on public.profiles to
-- hide grace-window soft-deleted rows from club-scoped reads while
-- continuing to surface anonymised rows (PII columns NULL) so
-- downstream JOINs can render "Deleted player" for cross-user
-- record continuity (tournament_team_members, t20_assessments, etc.).
--
-- What stays the same:
--   profiles_super_admin_all (FOR ALL)  — super_admin sees + writes
--                                         every row regardless of
--                                         deleted_at, including
--                                         grace-window rows. Needed
--                                         for compliance review +
--                                         admin-driven deletion +
--                                         restore.
--   profiles_self_rw (FOR ALL)          — self sees + writes own
--                                         row regardless of
--                                         deleted_at. Needed for
--                                         restore-on-login (user
--                                         needs to detect their own
--                                         pending-deletion state +
--                                         set deleted_at = NULL).
--
-- What changes:
--   profiles_club_admin_read (SELECT)   — adds soft-delete filter:
--   profiles_same_club_read (SELECT)        the cross-user read
--                                         returns the row only if
--                                         (a) deleted_at IS NULL
--                                         (active), OR (b)
--                                         first_name IS NULL AND
--                                         last_name IS NULL
--                                         (anonymised). The
--                                         in-between state (deleted_at
--                                         set + PII intact = grace
--                                         window) is hidden from
--                                         cross-user views.
--
-- Why first_name + last_name (not pending_auth_ban) as the
-- anonymisation marker:
--   Defence-in-depth. If the pg_cron anonymise job (Batch G) has a
--   bug that flips pending_auth_ban=true without actually NULLing
--   the PII columns, a pending_auth_ban-based filter would leak the
--   PII to cross-user views. The PII-presence check guarantees no
--   row with PII intact is visible to non-self / non-super_admin
--   readers regardless of the state-flag accuracy. Active partial
--   profiles (no first/last name set yet) are protected by the
--   first branch (deleted_at IS NULL) — they're visible.
--
-- club_memberships RLS deliberately unchanged:
--   Soft-deleted users' membership rows stay visible to club_admins
--   + same-club readers for audit-trail continuity. The JOIN to
--   profiles (for member-name display) inherits the new filter:
--   during grace the JOIN returns NULL for the profile fields,
--   post-anonymisation the JOIN returns the anonymised row. UI
--   handles both cases in Batch H.
--
-- Dependent tables that JOIN profiles for display
-- (tournament_team_members, t20_assessments, matches, messages,
-- bookings, audit_log) need NO RLS changes. Their existing
-- club-scoped / participant-scoped policies stay; they read profiles
-- via the JOIN and the new profiles RLS filters appropriately.
--
-- Verification path: F2 ships an integration suite covering
-- self-read during grace, cross-user grace-hidden, cross-user
-- anonymised-visible, super_admin sees all states, plus the
-- update-policy paths (self set/reset, non-self denied, super_admin
-- can set on any).

drop policy if exists profiles_club_admin_read on public.profiles;
drop policy if exists profiles_same_club_read on public.profiles;

create policy profiles_club_admin_read on public.profiles
  for select to authenticated
  using (
    public.current_role() = 'club_admin'
    and exists (
      select 1 from public.club_memberships cm
       where cm.profile_id = public.profiles.id
         and cm.club_id = any(public.current_club_ids())
    )
    and (
      deleted_at is null
      or (first_name is null and last_name is null)
    )
  );

create policy profiles_same_club_read on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.club_memberships cm
       where cm.profile_id = public.profiles.id
         and cm.club_id = any(public.current_club_ids())
    )
    and (
      deleted_at is null
      or (first_name is null and last_name is null)
    )
  );

comment on policy profiles_club_admin_read on public.profiles is
  'Club admins read profiles of members of their club(s). POPIA '
  'soft-delete filter (Phase 13 / 13-2b / 044): row visible only if '
  'active (deleted_at IS NULL) or anonymised (first_name + last_name '
  'both NULL). Grace-window rows (deleted_at set, PII intact) are '
  'hidden — the user is treated as gone from cross-user views during '
  'their 30-day grace period.';

comment on policy profiles_same_club_read on public.profiles is
  'Any authenticated user reads profiles of fellow club members. '
  'POPIA soft-delete filter (Phase 13 / 13-2b / 044): same predicate '
  'as profiles_club_admin_read.';
