-- Phase 2 / Migration 010 — Row-level security
-- Helper functions + enable RLS + policies per the three-tier model:
--   super_admin = all ops on all tables
--   club_admin  = scoped to club_admin_assignments.club_id
--   player      = own rows + same-club non-PII reads
--
-- Helpers live in `public` schema because local Supabase postgres cannot
-- write to `auth`. Both are SECURITY INVOKER and simply project claims
-- from auth.jwt() through a typed signature. See skill: supabase-migrations.

-- Helpers --------------------------------------------------------------------

create or replace function public.current_role()
returns user_role
language sql
stable
as $$
  select nullif(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    ''
  )::user_role
$$;

create or replace function public.current_club_ids()
returns uuid[]
language sql
stable
as $$
  select coalesce(
    array(
      select jsonb_array_elements_text(auth.jwt() -> 'app_metadata' -> 'club_ids')::uuid
    ),
    '{}'::uuid[]
  )
$$;

grant execute on function public.current_role()     to authenticated, anon;
grant execute on function public.current_club_ids() to authenticated, anon;

-- Cross-table helpers (SECURITY DEFINER) ------------------------------------
-- These wrap joins across tournaments ↔ tournament_teams ↔ tournament_team_members
-- so member-read policies don't trigger mutual RLS recursion. SECURITY DEFINER
-- makes them bypass RLS on the read side; we still gate the caller via the
-- outer policy. Functions are constrained to the `public` search_path so a
-- malicious schema can't hijack the table resolution.

create or replace function public.is_tournament_participant(
  p_tournament uuid, p_profile uuid
) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tournament_entries
     where tournament_id = p_tournament and profile_id = p_profile
  ) or exists (
    select 1 from public.tournament_team_members m
     join public.tournament_teams tt on tt.id = m.team_id
     where tt.tournament_id = p_tournament and m.profile_id = p_profile
  );
$$;

create or replace function public.tournament_host_club(p_tournament uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select host_club_id from public.tournaments where id = p_tournament;
$$;

create or replace function public.team_tournament_id(p_team uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select tournament_id from public.tournament_teams where id = p_team;
$$;

create or replace function public.is_team_member(p_team uuid, p_profile uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tournament_team_members
     where team_id = p_team and profile_id = p_profile
  );
$$;

create or replace function public.match_tournament_id(p_match uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select tournament_id from public.matches where id = p_match;
$$;

create or replace function public.is_match_participant(
  p_match uuid, p_profile uuid
) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tournament_team_members m
     join public.matches mm on (m.team_id = mm.home_team_id or m.team_id = mm.away_team_id)
     where mm.id = p_match and m.profile_id = p_profile
  );
$$;

create or replace function public.is_message_recipient(
  p_message uuid, p_profile uuid
) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.message_recipients
     where message_id = p_message and profile_id = p_profile
  );
$$;

create or replace function public.message_club_id(p_message uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select club_id from public.messages where id = p_message;
$$;

grant execute on function public.is_tournament_participant(uuid, uuid) to authenticated;
grant execute on function public.tournament_host_club(uuid)            to authenticated;
grant execute on function public.team_tournament_id(uuid)              to authenticated;
grant execute on function public.is_team_member(uuid, uuid)            to authenticated;
grant execute on function public.match_tournament_id(uuid)             to authenticated;
grant execute on function public.is_match_participant(uuid, uuid)      to authenticated;
grant execute on function public.is_message_recipient(uuid, uuid)      to authenticated;
grant execute on function public.message_club_id(uuid)                 to authenticated;

-- Enable RLS on every table -------------------------------------------------

alter table public.districts                  enable row level security;
alter table public.clubs                      enable row level security;
alter table public.profiles                   enable row level security;
alter table public.club_memberships           enable row level security;
alter table public.club_admin_assignments     enable row level security;
alter table public.greens                     enable row level security;
alter table public.rinks                      enable row level security;
alter table public.booking_windows            enable row level security;
alter table public.tournaments                enable row level security;
alter table public.tournament_entries         enable row level security;
alter table public.tournament_teams           enable row level security;
alter table public.tournament_team_members    enable row level security;
alter table public.matches                    enable row level security;
alter table public.match_ends                 enable row level security;
alter table public.bookings                   enable row level security;
alter table public.t20_rubric_versions        enable row level security;
alter table public.t20_assessments            enable row level security;
alter table public.t20_deliveries             enable row level security;
alter table public.messages                   enable row level security;
alter table public.message_recipients         enable row level security;
alter table public.notifications              enable row level security;

-- Districts ------------------------------------------------------------------
-- Fixed reference data. Everyone authenticated can read; only super_admin writes.
create policy districts_read_all on public.districts
  for select to authenticated
  using (true);

create policy districts_super_admin_all on public.districts
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

-- Clubs ----------------------------------------------------------------------
create policy clubs_super_admin_all on public.clubs
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy clubs_club_admin_rw on public.clubs
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and id = any(public.current_club_ids())
  )
  with check (
    public.current_role() = 'club_admin'
    and id = any(public.current_club_ids())
  );

-- Players read only clubs they belong to (the client needs this for the
-- club switcher + theme resolution).
create policy clubs_player_read_own on public.clubs
  for select to authenticated
  using (id = any(public.current_club_ids()));

-- Profiles -------------------------------------------------------------------
-- Self always RW. Super-admin full. Club-admin reads + limited updates on
-- profiles that are members of their club(s). Player reads profiles of
-- fellow members (app layer must project non-PII columns only — see
-- drift note in stop & report).
create policy profiles_super_admin_all on public.profiles
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy profiles_self_rw on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_club_admin_read on public.profiles
  for select to authenticated
  using (
    public.current_role() = 'club_admin'
    and exists (
      select 1 from public.club_memberships cm
       where cm.profile_id = public.profiles.id
         and cm.club_id = any(public.current_club_ids())
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
  );

-- Club memberships -----------------------------------------------------------
create policy club_memberships_super_admin_all on public.club_memberships
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy club_memberships_club_admin_rw on public.club_memberships
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and club_id = any(public.current_club_ids())
  )
  with check (
    public.current_role() = 'club_admin'
    and club_id = any(public.current_club_ids())
  );

create policy club_memberships_self_read on public.club_memberships
  for select to authenticated
  using (profile_id = auth.uid());

create policy club_memberships_same_club_read on public.club_memberships
  for select to authenticated
  using (club_id = any(public.current_club_ids()));

-- Club-admin assignments -----------------------------------------------------
-- Only super-admin can mutate. Assigned profiles see their own rows.
create policy club_admin_assignments_super_admin_all on public.club_admin_assignments
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy club_admin_assignments_self_read on public.club_admin_assignments
  for select to authenticated
  using (profile_id = auth.uid());

-- Greens + rinks -------------------------------------------------------------
create policy greens_super_admin_all on public.greens
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy greens_club_admin_rw on public.greens
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and club_id = any(public.current_club_ids())
  )
  with check (
    public.current_role() = 'club_admin'
    and club_id = any(public.current_club_ids())
  );

create policy greens_member_read on public.greens
  for select to authenticated
  using (club_id = any(public.current_club_ids()));

create policy rinks_super_admin_all on public.rinks
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy rinks_club_admin_rw on public.rinks
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and exists (
      select 1 from public.greens g
       where g.id = rinks.green_id
         and g.club_id = any(public.current_club_ids())
    )
  )
  with check (
    public.current_role() = 'club_admin'
    and exists (
      select 1 from public.greens g
       where g.id = rinks.green_id
         and g.club_id = any(public.current_club_ids())
    )
  );

create policy rinks_member_read on public.rinks
  for select to authenticated
  using (
    exists (
      select 1 from public.greens g
       where g.id = rinks.green_id
         and g.club_id = any(public.current_club_ids())
    )
  );

-- Booking windows ------------------------------------------------------------
create policy booking_windows_super_admin_all on public.booking_windows
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy booking_windows_club_admin_rw on public.booking_windows
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and club_id = any(public.current_club_ids())
  )
  with check (
    public.current_role() = 'club_admin'
    and club_id = any(public.current_club_ids())
  );

create policy booking_windows_member_read on public.booking_windows
  for select to authenticated
  using (club_id = any(public.current_club_ids()));

-- Tournaments ----------------------------------------------------------------
create policy tournaments_super_admin_all on public.tournaments
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy tournaments_host_club_admin_rw on public.tournaments
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and host_club_id = any(public.current_club_ids())
  )
  with check (
    public.current_role() = 'club_admin'
    and host_club_id = any(public.current_club_ids())
  );

-- Members can read tournaments hosted by their club(s) OR any tournament
-- they've entered / been drawn into. The participant check runs through a
-- SECURITY DEFINER helper so we don't trigger cross-table RLS recursion
-- (tournaments ↔ tournament_team_members ↔ tournament_teams).
create policy tournaments_member_read on public.tournaments
  for select to authenticated
  using (
    host_club_id = any(public.current_club_ids())
    or public.is_tournament_participant(id, auth.uid())
  );

-- Tournament entries ---------------------------------------------------------
create policy tournament_entries_super_admin_all on public.tournament_entries
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy tournament_entries_host_admin_rw on public.tournament_entries
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and public.tournament_host_club(tournament_id) = any(public.current_club_ids())
  )
  with check (
    public.current_role() = 'club_admin'
    and public.tournament_host_club(tournament_id) = any(public.current_club_ids())
  );

create policy tournament_entries_self_rw on public.tournament_entries
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy tournament_entries_host_member_read on public.tournament_entries
  for select to authenticated
  using (
    public.tournament_host_club(tournament_id) = any(public.current_club_ids())
  );

-- Tournament teams -----------------------------------------------------------
create policy tournament_teams_super_admin_all on public.tournament_teams
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy tournament_teams_host_admin_rw on public.tournament_teams
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and public.tournament_host_club(tournament_id) = any(public.current_club_ids())
  )
  with check (
    public.current_role() = 'club_admin'
    and public.tournament_host_club(tournament_id) = any(public.current_club_ids())
  );

create policy tournament_teams_read on public.tournament_teams
  for select to authenticated
  using (
    public.tournament_host_club(tournament_id) = any(public.current_club_ids())
    or public.is_team_member(id, auth.uid())
  );

-- Team members ---------------------------------------------------------------
create policy team_members_super_admin_all on public.tournament_team_members
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy team_members_host_admin_rw on public.tournament_team_members
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and public.tournament_host_club(public.team_tournament_id(team_id))
        = any(public.current_club_ids())
  )
  with check (
    public.current_role() = 'club_admin'
    and public.tournament_host_club(public.team_tournament_id(team_id))
        = any(public.current_club_ids())
  );

create policy team_members_self_read on public.tournament_team_members
  for select to authenticated
  using (profile_id = auth.uid());

create policy team_members_same_tournament_read on public.tournament_team_members
  for select to authenticated
  using (
    public.tournament_host_club(public.team_tournament_id(team_id))
      = any(public.current_club_ids())
  );

-- Matches --------------------------------------------------------------------
create policy matches_super_admin_all on public.matches
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy matches_host_admin_rw on public.matches
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and public.tournament_host_club(tournament_id) = any(public.current_club_ids())
  )
  with check (
    public.current_role() = 'club_admin'
    and public.tournament_host_club(tournament_id) = any(public.current_club_ids())
  );

create policy matches_participant_read on public.matches
  for select to authenticated
  using (
    public.is_team_member(home_team_id, auth.uid())
    or public.is_team_member(away_team_id, auth.uid())
    or public.tournament_host_club(tournament_id) = any(public.current_club_ids())
  );

-- Match ends -----------------------------------------------------------------
create policy match_ends_super_admin_all on public.match_ends
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy match_ends_host_admin_rw on public.match_ends
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and public.tournament_host_club(public.match_tournament_id(match_id))
        = any(public.current_club_ids())
  )
  with check (
    public.current_role() = 'club_admin'
    and public.tournament_host_club(public.match_tournament_id(match_id))
        = any(public.current_club_ids())
  );

-- Players who are on one of the two teams can submit their own match's ends.
create policy match_ends_participant_submit on public.match_ends
  for insert to authenticated
  with check (public.is_match_participant(match_id, auth.uid()));

create policy match_ends_participant_read on public.match_ends
  for select to authenticated
  using (
    public.is_match_participant(match_id, auth.uid())
    or public.tournament_host_club(public.match_tournament_id(match_id))
        = any(public.current_club_ids())
  );

-- Bookings -------------------------------------------------------------------
create policy bookings_super_admin_all on public.bookings
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy bookings_club_admin_rw on public.bookings
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and club_id = any(public.current_club_ids())
  )
  with check (
    public.current_role() = 'club_admin'
    and club_id = any(public.current_club_ids())
  );

-- Members see bookings at their club(s). Players can book for themselves
-- at their own club(s); cancel their own.
create policy bookings_member_read on public.bookings
  for select to authenticated
  using (club_id = any(public.current_club_ids()));

create policy bookings_self_insert on public.bookings
  for insert to authenticated
  with check (
    booked_by = auth.uid()
    and club_id = any(public.current_club_ids())
  );

create policy bookings_self_update on public.bookings
  for update to authenticated
  using (booked_by = auth.uid())
  with check (booked_by = auth.uid());

-- T20 rubric versions --------------------------------------------------------
-- Super-admin writes; everyone authenticated reads (so client can resolve
-- active rubric JSON).
create policy t20_rubric_super_admin_all on public.t20_rubric_versions
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy t20_rubric_read_all on public.t20_rubric_versions
  for select to authenticated
  using (true);

-- T20 assessments ------------------------------------------------------------
create policy t20_assessments_super_admin_all on public.t20_assessments
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy t20_assessments_club_admin_rw on public.t20_assessments
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and club_id = any(public.current_club_ids())
  )
  with check (
    public.current_role() = 'club_admin'
    and club_id = any(public.current_club_ids())
  );

-- Assessor can read + write assessments they own (even as a player).
create policy t20_assessments_assessor_rw on public.t20_assessments
  for all to authenticated
  using (assessor_id = auth.uid())
  with check (assessor_id = auth.uid());

create policy t20_assessments_subject_read on public.t20_assessments
  for select to authenticated
  using (profile_id = auth.uid());

-- T20 deliveries -------------------------------------------------------------
create policy t20_deliveries_super_admin_all on public.t20_deliveries
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy t20_deliveries_club_admin_rw on public.t20_deliveries
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and exists (
      select 1 from public.t20_assessments a
       where a.id = t20_deliveries.assessment_id
         and a.club_id = any(public.current_club_ids())
    )
  )
  with check (
    public.current_role() = 'club_admin'
    and exists (
      select 1 from public.t20_assessments a
       where a.id = t20_deliveries.assessment_id
         and a.club_id = any(public.current_club_ids())
    )
  );

create policy t20_deliveries_assessor_rw on public.t20_deliveries
  for all to authenticated
  using (
    exists (
      select 1 from public.t20_assessments a
       where a.id = t20_deliveries.assessment_id
         and a.assessor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.t20_assessments a
       where a.id = t20_deliveries.assessment_id
         and a.assessor_id = auth.uid()
    )
  );

create policy t20_deliveries_subject_read on public.t20_deliveries
  for select to authenticated
  using (
    exists (
      select 1 from public.t20_assessments a
       where a.id = t20_deliveries.assessment_id
         and a.profile_id = auth.uid()
    )
  );

-- Messages -------------------------------------------------------------------
create policy messages_super_admin_all on public.messages
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy messages_club_admin_rw on public.messages
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and club_id = any(public.current_club_ids())
  )
  with check (
    public.current_role() = 'club_admin'
    and club_id = any(public.current_club_ids())
  );

-- Players can see messages that they are a recipient of. Routed through a
-- SECURITY DEFINER helper to avoid cycling with message_recipients policies.
create policy messages_recipient_read on public.messages
  for select to authenticated
  using (public.is_message_recipient(id, auth.uid()));

-- Message recipients ---------------------------------------------------------
create policy message_recipients_super_admin_all on public.message_recipients
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy message_recipients_club_admin_read on public.message_recipients
  for select to authenticated
  using (
    public.current_role() = 'club_admin'
    and public.message_club_id(message_id) = any(public.current_club_ids())
  );

-- Recipient reads their own; can update read-state on own row.
create policy message_recipients_self_read on public.message_recipients
  for select to authenticated
  using (profile_id = auth.uid());

create policy message_recipients_self_update on public.message_recipients
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Notifications --------------------------------------------------------------
create policy notifications_super_admin_all on public.notifications
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy notifications_self_read on public.notifications
  for select to authenticated
  using (profile_id = auth.uid());

create policy notifications_self_update on public.notifications
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Club-admin may write notifications for their members (e.g. manual reminders).
create policy notifications_club_admin_insert on public.notifications
  for insert to authenticated
  with check (
    public.current_role() = 'club_admin'
    and (club_id is null or club_id = any(public.current_club_ids()))
  );
