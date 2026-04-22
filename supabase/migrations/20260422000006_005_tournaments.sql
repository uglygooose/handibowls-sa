-- Phase 2 / Migration 005 — tournaments, entries, teams, matches, ends
-- Supports all 5 disciplines (singles, pairs, triples, fours, mixed_pairs),
-- scratch + handicap_start rules, and structures knockout / round_robin /
-- sectional / drawn_social. Matches reference rinks (migration 004); ends
-- are the per-end score rows.

-- Tournaments ----------------------------------------------------------------
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  host_club_id uuid not null references public.clubs(id) on delete restrict,
  name text not null,
  scope tournament_scope not null default 'club',
  format tournament_format not null,
  structure tournament_structure not null,
  category category not null default 'open',
  age_group age_group not null default 'open',
  handicap_rule handicap_rule not null default 'scratch',
  status tournament_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  entries_close_at timestamptz,
  max_entries integer,
  ends_per_match integer,
  shots_up_target integer,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournaments_dates_order check (
    starts_at is null or ends_at is null or ends_at >= starts_at
  ),
  constraint tournaments_max_entries_positive check (
    max_entries is null or max_entries > 0
  )
);

create index tournaments_host_club_idx on public.tournaments (host_club_id);
create index tournaments_status_idx on public.tournaments (status);
create index tournaments_starts_at_idx on public.tournaments (starts_at);

create trigger tournaments_set_updated_at
  before update on public.tournaments
  for each row execute function public.set_updated_at();

-- Tournament entries ---------------------------------------------------------
-- One row per accepted entry before the draw. For singles this is a profile;
-- for team formats it's typically a club-level nomination of N profiles,
-- which the draw then packages into tournament_teams.
create table public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete restrict,
  profile_id uuid references public.profiles(id) on delete set null,
  team_name text,
  seed integer,
  withdrawn boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_entries_unique_profile unique (tournament_id, profile_id)
);

create index tournament_entries_tournament_idx on public.tournament_entries (tournament_id);
create index tournament_entries_club_idx on public.tournament_entries (club_id);

create trigger tournament_entries_set_updated_at
  before update on public.tournament_entries
  for each row execute function public.set_updated_at();

-- Tournament teams -----------------------------------------------------------
-- The drawn, confirmed teams (post-seed). For singles a team is one member.
create table public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete set null,
  name text,
  seed integer,
  section_label text,
  handicap_shots integer not null default 0,
  withdrawn boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tournament_teams_tournament_idx on public.tournament_teams (tournament_id);

create trigger tournament_teams_set_updated_at
  before update on public.tournament_teams
  for each row execute function public.set_updated_at();

-- Team members ---------------------------------------------------------------
create table public.tournament_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.tournament_teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  position player_position not null,
  bowl_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_members_unique_profile_per_team unique (team_id, profile_id),
  constraint team_members_bowl_order_range check (bowl_order is null or bowl_order between 1 and 4)
);

create index team_members_team_idx on public.tournament_team_members (team_id);
create index team_members_profile_idx on public.tournament_team_members (profile_id);

create trigger team_members_set_updated_at
  before update on public.tournament_team_members
  for each row execute function public.set_updated_at();

-- Matches --------------------------------------------------------------------
-- A scheduled/played match between two teams. Bracket + round for knockouts;
-- section_label for sectional; null for drawn/social. Rink is optional until
-- assignment. home/away shots denormalised from match_ends for quick reads.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  home_team_id uuid references public.tournament_teams(id) on delete set null,
  away_team_id uuid references public.tournament_teams(id) on delete set null,
  rink_id uuid references public.rinks(id) on delete set null,
  round integer,
  bracket_slot integer,
  section_label text,
  status match_status not null default 'scheduled',
  starts_at timestamptz,
  ends_at timestamptz,
  home_shots integer not null default 0,
  away_shots integer not null default 0,
  home_ends_won integer not null default 0,
  away_ends_won integer not null default 0,
  winner_team_id uuid references public.tournament_teams(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_shots_nonneg check (home_shots >= 0 and away_shots >= 0),
  constraint matches_ends_nonneg check (home_ends_won >= 0 and away_ends_won >= 0),
  constraint matches_winner_is_participant check (
    winner_team_id is null
    or winner_team_id = home_team_id
    or winner_team_id = away_team_id
  )
);

create index matches_tournament_idx on public.matches (tournament_id);
create index matches_home_team_idx on public.matches (home_team_id);
create index matches_away_team_idx on public.matches (away_team_id);
create index matches_status_idx on public.matches (status);

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

-- Match ends -----------------------------------------------------------------
-- Per-end score rows. `end` is reserved in SQL; column is `end_number`.
-- Terminology: an "end" is one direction of play up the rink (see bsa-terminology).
create table public.match_ends (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  end_number integer not null,
  home_shots integer not null default 0,
  away_shots integer not null default 0,
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  notes text,
  constraint match_ends_number_positive check (end_number > 0),
  constraint match_ends_shots_nonneg check (home_shots >= 0 and away_shots >= 0),
  constraint match_ends_unique_per_match unique (match_id, end_number)
);

create index match_ends_match_idx on public.match_ends (match_id);
