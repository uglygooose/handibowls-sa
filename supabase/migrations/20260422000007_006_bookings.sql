-- Phase 2 / Migration 006 — bookings
-- Rink bookings with a GIST exclusion constraint preventing overlaps per rink
-- for rows where status = 'booked'. Cancellations are retained for audit but
-- don't block new bookings on the same slot.

create extension if not exists btree_gist;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  rink_id uuid not null references public.rinks(id) on delete restrict,
  club_id uuid not null references public.clubs(id) on delete restrict,
  booked_by uuid references public.profiles(id) on delete set null,
  purpose booking_purpose not null default 'roll_up',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status booking_status not null default 'booked',
  party_size integer,
  notes text,
  match_id uuid references public.matches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_order check (ends_at > starts_at),
  constraint bookings_party_size_positive check (party_size is null or party_size > 0)
);

create index bookings_rink_idx on public.bookings (rink_id);
create index bookings_club_idx on public.bookings (club_id);
create index bookings_booked_by_idx on public.bookings (booked_by);
create index bookings_starts_at_idx on public.bookings (starts_at);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- No-overlap per rink (only active bookings count).
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    rink_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status = 'booked');
