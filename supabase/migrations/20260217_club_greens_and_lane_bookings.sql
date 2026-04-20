-- Greens + lane booking (AM/PM)
-- Run this in the Supabase SQL editor for your project.

create extension if not exists "pgcrypto";

-- Updated-at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Greens owned by a club (typically 6 lanes each)
create table if not exists public.club_greens (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  lane_count int not null default 6 check (lane_count >= 1 and lane_count <= 24),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_club_greens_updated_at on public.club_greens;
create trigger trg_club_greens_updated_at
before update on public.club_greens
for each row execute function public.set_updated_at();

-- Lane bookings (date + AM/PM + lane number)
create table if not exists public.lane_bookings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  green_id uuid not null references public.club_greens(id) on delete cascade,
  booking_date date not null,
  session text not null check (session in ('AM', 'PM')),
  lane_number int not null check (lane_number >= 1),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists lane_bookings_unique_slot
  on public.lane_bookings (green_id, booking_date, session, lane_number);

create index if not exists lane_bookings_by_club_day
  on public.lane_bookings (club_id, booking_date, session);

alter table public.club_greens enable row level security;
alter table public.lane_bookings enable row level security;

-- Helper predicates
create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and upper(coalesce(p.role, '')) = 'SUPER_ADMIN'
  );
$$;

create or replace function public.my_club_id()
returns uuid
language sql
stable
as $$
  select p.club_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.is_club_admin(club_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        upper(coalesce(p.role, '')) = 'SUPER_ADMIN'
        or (p.is_admin = true and p.club_id = club_uuid)
      )
  );
$$;

-- club_greens policies
drop policy if exists club_greens_select on public.club_greens;
create policy club_greens_select
on public.club_greens
for select
to authenticated
using (
  public.is_super_admin()
  or club_id = public.my_club_id()
);

drop policy if exists club_greens_insert on public.club_greens;
create policy club_greens_insert
on public.club_greens
for insert
to authenticated
with check (
  public.is_club_admin(club_id)
);

drop policy if exists club_greens_update on public.club_greens;
create policy club_greens_update
on public.club_greens
for update
to authenticated
using (
  public.is_club_admin(club_id)
)
with check (
  public.is_club_admin(club_id)
);

drop policy if exists club_greens_delete on public.club_greens;
create policy club_greens_delete
on public.club_greens
for delete
to authenticated
using (
  public.is_club_admin(club_id)
);

-- lane_bookings policies
drop policy if exists lane_bookings_select on public.lane_bookings;
create policy lane_bookings_select
on public.lane_bookings
for select
to authenticated
using (
  public.is_super_admin()
  or club_id = public.my_club_id()
);

drop policy if exists lane_bookings_insert on public.lane_bookings;
create policy lane_bookings_insert
on public.lane_bookings
for insert
to authenticated
with check (
  created_by = auth.uid()
  and club_id = public.my_club_id()
  and exists (
    select 1
    from public.club_greens g
    where g.id = lane_bookings.green_id
      and g.club_id = lane_bookings.club_id
      and g.is_active = true
  )
);

drop policy if exists lane_bookings_delete on public.lane_bookings;
create policy lane_bookings_delete
on public.lane_bookings
for delete
to authenticated
using (
  public.is_super_admin()
  or created_by = auth.uid()
  or public.is_club_admin(club_id)
);

