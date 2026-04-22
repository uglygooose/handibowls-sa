-- Phase 2 / Migration 001 — enums
-- All enum types used across the HandiBowls schema. Defined first so every
-- downstream table migration can reference them. Values follow BSA canonical
-- terminology (see skill: bsa-terminology).

-- Identity ------------------------------------------------------------------

create type user_role as enum ('super_admin', 'club_admin', 'player');

create type gender as enum ('male', 'female', 'other', 'prefer_not');

create type dominant_hand as enum ('right', 'left');

create type membership_status as enum ('active', 'inactive', 'pending');

create type player_position as enum ('skip', 'third', 'second', 'lead');

-- Tournament / competition --------------------------------------------------

create type category as enum ('men', 'women', 'mixed', 'open');

create type age_group as enum ('open', 'veteran', 'junior', 'u35');

-- Includes 'triples' (club/district only per BSA, Q9) alongside the four
-- national disciplines.
create type tournament_format as enum (
  'singles',
  'pairs',
  'triples',
  'fours',
  'mixed_pairs'
);

create type tournament_structure as enum (
  'knockout',
  'round_robin',
  'sectional',
  'drawn_social'
);

create type tournament_scope as enum ('club', 'district', 'provincial', 'national');

-- Scratch is default for BSA-scoped events; handicap_start is club-internal
-- only (Q8). See bsa-terminology.
create type handicap_rule as enum ('scratch', 'handicap_start');

create type tournament_status as enum (
  'draft',
  'open',
  'in_progress',
  'completed',
  'cancelled'
);

create type match_status as enum (
  'scheduled',
  'in_progress',
  'completed',
  'walkover',
  'cancelled'
);

-- Bookings ------------------------------------------------------------------

create type booking_status as enum ('booked', 'cancelled');

create type booking_purpose as enum ('roll_up', 'practice', 'coaching', 'match', 'social');

-- T20 assessment ------------------------------------------------------------

create type t20_section as enum (
  'jacks',
  'targets',
  'drive',
  'control',
  'trail',
  'speedhumps_asc',
  'speedhumps_desc'
);

create type t20_grade as enum ('gold', 'silver', 'bronze', 'fail');

-- Messaging -----------------------------------------------------------------

-- Email-only per Q6 — no SMS channel in the bundle.
create type message_channel as enum ('in_app', 'email');

create type message_status as enum ('draft', 'queued', 'sent', 'failed');

create type message_recipient_status as enum ('unread', 'read', 'archived');

-- Invites + consent ---------------------------------------------------------

create type invite_status as enum ('pending', 'accepted', 'expired', 'revoked');

create type consent_type as enum ('terms', 'privacy', 'marketing');

-- Club theme ----------------------------------------------------------------

-- The 9 HandiBowls presets (see components/brand/ThemeApplier). Matches
-- data-theme values applied to <html> client-side.
create type club_theme_preset as enum (
  'atomic-red',
  'ocean-blue',
  'sunburst',
  'midnight',
  'ruby',
  'ocean-green',
  'grape',
  'white-speckle',
  'core-black'
);
