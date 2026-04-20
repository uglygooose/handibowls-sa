-- Game invites + match scheduling link to lane bookings
-- Run this after 20260217_club_greens_and_lane_bookings.sql

create extension if not exists "pgcrypto";

-- Resolve current user's player id (if any)
create or replace function public.my_player_id()
returns uuid
language sql
stable
as $$
  select p.id
  from public.players p
  where p.user_id = auth.uid()
  limit 1;
$$;

-- Link a match to a booking + store game format metadata (future: tournament assignment too)
create table if not exists public.match_schedules (
  match_id uuid primary key references public.matches(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  booking_id uuid null references public.lane_bookings(id) on delete set null,
  game_format text not null check (game_format in ('SINGLES', 'DOUBLES', 'TRIPLES', 'FOUR_BALL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_match_schedules_updated_at on public.match_schedules;
create trigger trg_match_schedules_updated_at
before update on public.match_schedules
for each row execute function public.set_updated_at();

create index if not exists match_schedules_by_club on public.match_schedules (club_id);
create index if not exists match_schedules_by_booking on public.match_schedules (booking_id);

-- Invite flow for non-ranked games (replaces "Friendly" challenges)
create table if not exists public.game_invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  inviter_player_id uuid not null references public.players(id) on delete cascade,
  invitee_player_id uuid not null references public.players(id) on delete cascade,
  booking_id uuid null references public.lane_bookings(id) on delete set null,
  game_format text not null check (game_format in ('SINGLES', 'DOUBLES', 'TRIPLES', 'FOUR_BALL')),
  status text not null check (status in ('PROPOSED', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
  match_id uuid null references public.matches(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz null
);

create index if not exists game_invites_by_club on public.game_invites (club_id, created_at desc);
create index if not exists game_invites_by_inviter on public.game_invites (inviter_player_id, created_at desc);
create index if not exists game_invites_by_invitee on public.game_invites (invitee_player_id, created_at desc);
create index if not exists game_invites_by_booking on public.game_invites (booking_id);

alter table public.match_schedules enable row level security;
alter table public.game_invites enable row level security;

-- match_schedules policies (club scoped)
drop policy if exists match_schedules_select on public.match_schedules;
create policy match_schedules_select
on public.match_schedules
for select
to authenticated
using (
  public.is_super_admin()
  or club_id = public.my_club_id()
);

drop policy if exists match_schedules_insert on public.match_schedules;
create policy match_schedules_insert
on public.match_schedules
for insert
to authenticated
with check (
  club_id = public.my_club_id()
);

drop policy if exists match_schedules_update on public.match_schedules;
create policy match_schedules_update
on public.match_schedules
for update
to authenticated
using (
  public.is_super_admin()
  or public.is_club_admin(club_id)
)
with check (
  public.is_super_admin()
  or public.is_club_admin(club_id)
);

drop policy if exists match_schedules_delete on public.match_schedules;
create policy match_schedules_delete
on public.match_schedules
for delete
to authenticated
using (
  public.is_super_admin()
  or public.is_club_admin(club_id)
);

-- game_invites policies: only involved players in your club
drop policy if exists game_invites_select on public.game_invites;
create policy game_invites_select
on public.game_invites
for select
to authenticated
using (
  public.is_super_admin()
  or (
    club_id = public.my_club_id()
    and (inviter_player_id = public.my_player_id() or invitee_player_id = public.my_player_id())
  )
);

drop policy if exists game_invites_insert on public.game_invites;
create policy game_invites_insert
on public.game_invites
for insert
to authenticated
with check (
  club_id = public.my_club_id()
  and inviter_player_id = public.my_player_id()
);

drop policy if exists game_invites_update on public.game_invites;
create policy game_invites_update
on public.game_invites
for update
to authenticated
using (
  public.is_super_admin()
  or (
    club_id = public.my_club_id()
    and (inviter_player_id = public.my_player_id() or invitee_player_id = public.my_player_id())
  )
)
with check (
  public.is_super_admin()
  or (
    club_id = public.my_club_id()
    and (inviter_player_id = public.my_player_id() or invitee_player_id = public.my_player_id())
  )
);

-- Extend lane_bookings delete policy so either invite party can free the reserved slot.
drop policy if exists lane_bookings_delete on public.lane_bookings;
create policy lane_bookings_delete
on public.lane_bookings
for delete
to authenticated
using (
  public.is_super_admin()
  or created_by = auth.uid()
  or public.is_club_admin(club_id)
  or exists (
    select 1
    from public.game_invites gi
    where gi.booking_id = lane_bookings.id
      and (gi.inviter_player_id = public.my_player_id() or gi.invitee_player_id = public.my_player_id())
  )
);
