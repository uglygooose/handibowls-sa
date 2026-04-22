-- Phase 2 / Migration 002 — core identity
-- BSA districts, clubs, profiles (1:1 with auth.users), club memberships,
-- and club-admin assignments. All further relational work hangs off these.
-- RLS is enabled in migration 010; tables are defined first so the JWT hook
-- (009) can reference profiles + assignments.

-- Common updated_at trigger --------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Districts ------------------------------------------------------------------
-- 20 BSA districts seeded in migration 003. Read-only from app code.
create table public.districts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  province text not null,
  short_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint districts_name_unique unique (name)
);

create trigger districts_set_updated_at
  before update on public.districts
  for each row execute function public.set_updated_at();

-- Clubs ----------------------------------------------------------------------
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete restrict,
  name text not null,
  short_name text,
  slug text not null,
  city text not null,
  contact_email text,
  contact_phone text,
  logo_url text,
  theme_preset club_theme_preset not null default 'atomic-red',
  handicap_enabled boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clubs_slug_unique unique (slug),
  constraint clubs_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create index clubs_district_id_idx on public.clubs (district_id);
create index clubs_active_idx on public.clubs (active) where active = true;

create trigger clubs_set_updated_at
  before update on public.clubs
  for each row execute function public.set_updated_at();

-- Profiles -------------------------------------------------------------------
-- 1:1 with auth.users (id matches auth.users.id). Role lives here — the JWT
-- hook reads it into app_metadata on token issue. Profile_completed gate
-- drives the /me/setup redirect in Phase 5.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'player',
  first_name text,
  last_name text,
  display_name text,
  email text,
  phone text,
  gender gender,
  date_of_birth date,
  bsa_number text,
  dominant_hand dominant_hand,
  avatar_url text,
  email_opt_in boolean not null default true,
  profile_completed boolean not null default false,
  novice_registered_at date,
  handicap integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_bsa_number_format check (
    bsa_number is null or bsa_number ~ '^[A-Z0-9-]{3,20}$'
  )
);

create index profiles_role_idx on public.profiles (role);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Club memberships -----------------------------------------------------------
-- Many-to-many with playing role + status. Dual-club handled via is_primary
-- (partial unique index: at most one primary per profile).
create table public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  status membership_status not null default 'active',
  is_primary boolean not null default false,
  club_grading player_position,
  membership_number text,
  joined_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_memberships_unique unique (profile_id, club_id)
);

create unique index club_memberships_one_primary
  on public.club_memberships (profile_id)
  where is_primary = true;

create index club_memberships_club_id_idx on public.club_memberships (club_id);
create index club_memberships_profile_id_idx on public.club_memberships (profile_id);

create trigger club_memberships_set_updated_at
  before update on public.club_memberships
  for each row execute function public.set_updated_at();

-- Club-admin assignments -----------------------------------------------------
-- A profile can admin >1 club (rare). The JWT hook unions this + active
-- memberships into app_metadata.club_ids for RLS scoping.
create table public.club_admin_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_admin_assignments_unique unique (profile_id, club_id)
);

create index club_admin_assignments_club_id_idx on public.club_admin_assignments (club_id);

create trigger club_admin_assignments_set_updated_at
  before update on public.club_admin_assignments
  for each row execute function public.set_updated_at();

-- Profile auto-create trigger ------------------------------------------------
-- Every new auth.users row gets a profiles row with role=player by default.
-- Super-admins and club-admins are upgraded explicitly via role column edits.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
