-- Phase 2 / Migration 004 — greens, rinks, booking windows
-- A club has 1+ greens; each green has N rinks (typically 6). Booking windows
-- bound when a rink can be reserved (opening hours / blackout). Terminology
-- (green / rink, not lane / court) per skill: bsa-terminology.

-- Greens ---------------------------------------------------------------------
create table public.greens (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  surface text,
  rink_count integer not null default 6,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint greens_name_unique_per_club unique (club_id, name),
  constraint greens_rink_count_range check (rink_count between 1 and 12)
);

create index greens_club_id_idx on public.greens (club_id);

create trigger greens_set_updated_at
  before update on public.greens
  for each row execute function public.set_updated_at();

-- Rinks ----------------------------------------------------------------------
-- Rinks are numbered 1..N within a green.
create table public.rinks (
  id uuid primary key default gen_random_uuid(),
  green_id uuid not null references public.greens(id) on delete cascade,
  number integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rinks_number_unique_per_green unique (green_id, number),
  constraint rinks_number_range check (number between 1 and 12)
);

create index rinks_green_id_idx on public.rinks (green_id);

create trigger rinks_set_updated_at
  before update on public.rinks
  for each row execute function public.set_updated_at();

-- Booking windows ------------------------------------------------------------
-- Recurring weekday windows (e.g. "Mon–Fri 08:00–17:00") plus one-off closures.
-- A window with is_closure=true blocks bookings; otherwise it permits them.
create table public.booking_windows (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  green_id uuid references public.greens(id) on delete cascade,
  label text,
  -- 0 = Sunday, 6 = Saturday; null = one-off date range.
  weekday smallint,
  starts_time time,
  ends_time time,
  starts_date date,
  ends_date date,
  is_closure boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_windows_weekday_range check (weekday is null or weekday between 0 and 6),
  constraint booking_windows_time_shape check (
    (weekday is not null and starts_time is not null and ends_time is not null)
    or (starts_date is not null and ends_date is not null)
  )
);

create index booking_windows_club_id_idx on public.booking_windows (club_id);
create index booking_windows_green_id_idx on public.booking_windows (green_id);

create trigger booking_windows_set_updated_at
  before update on public.booking_windows
  for each row execute function public.set_updated_at();
