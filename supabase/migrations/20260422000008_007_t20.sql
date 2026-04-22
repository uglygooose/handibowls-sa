-- Phase 2 / Migration 007 — T20 assessment module
-- Production rubric schema (Q7). Rubric JSON is versioned and seeded in
-- migration 013. Each assessment immutably references the version active at
-- capture time. Deliveries are normalised: one row per bowl, carrying the
-- outcome payload relevant to that section's scoring model.

-- Rubric versions ------------------------------------------------------------
create table public.t20_rubric_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  rubric jsonb not null,
  is_active boolean not null default false,
  activated_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint t20_rubric_versions_version_unique unique (version)
);

-- At most one active rubric at a time.
create unique index t20_rubric_versions_one_active
  on public.t20_rubric_versions ((is_active))
  where is_active = true;

create trigger t20_rubric_versions_set_updated_at
  before update on public.t20_rubric_versions
  for each row execute function public.set_updated_at();

-- Assessments ----------------------------------------------------------------
create table public.t20_assessments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  assessor_id uuid not null references public.profiles(id) on delete restrict,
  assessor_accreditation_id text,
  rubric_version_id uuid not null references public.t20_rubric_versions(id) on delete restrict,
  assessed_on date not null default current_date,
  green_type text,
  green_speed numeric(4,2),
  second_marker_name text,
  total_score numeric(8,2) not null default 0,
  percentage numeric(5,2) not null default 0,
  grade t20_grade,
  status text not null default 'draft',
  notes text,
  pdf_url text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint t20_assessments_status_allowed check (status in ('draft', 'submitted', 'archived')),
  constraint t20_assessments_percentage_range check (percentage between 0 and 100)
);

create index t20_assessments_club_idx on public.t20_assessments (club_id);
create index t20_assessments_profile_idx on public.t20_assessments (profile_id);
create index t20_assessments_assessor_idx on public.t20_assessments (assessor_id);
create index t20_assessments_assessed_on_idx on public.t20_assessments (assessed_on);

create trigger t20_assessments_set_updated_at
  before update on public.t20_assessments
  for each row execute function public.set_updated_at();

-- Deliveries -----------------------------------------------------------------
-- One row per bowl delivered. `outcome` is a small jsonb carrying the
-- section-specific payload: { zone: 1..8 | 'miss' } for zones_8 models,
-- { line: 'on_line'|'narrow'|'wide', side: 'L'|'R'|null } for line_outcome,
-- { on_length: bool } for on_length.
create table public.t20_deliveries (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.t20_assessments(id) on delete cascade,
  section t20_section not null,
  round smallint not null,
  delivery_index smallint not null,
  distance_m smallint,
  hand text,
  outcome jsonb not null default '{}'::jsonb,
  points numeric(6,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint t20_deliveries_round_range check (round in (1, 2)),
  constraint t20_deliveries_index_range check (delivery_index between 1 and 8),
  constraint t20_deliveries_hand_allowed check (hand is null or hand in ('fore', 'back')),
  constraint t20_deliveries_unique_slot unique (assessment_id, section, round, delivery_index, distance_m)
);

create index t20_deliveries_assessment_idx on public.t20_deliveries (assessment_id);
create index t20_deliveries_section_idx on public.t20_deliveries (section);
