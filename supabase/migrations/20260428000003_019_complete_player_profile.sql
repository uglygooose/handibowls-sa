-- Phase 5d / Migration 019 — complete_player_profile RPC
--
-- Atomic profile-completion for the /me/setup wizard. In one transaction:
--   • profiles row updated with the wizard's identity / bowls / contact data
--   • club_memberships PRIMARY row gets the chosen club_grading (per BSA:
--     skip / third / second / lead — values per migration 001 enum)
--   • consents rows inserted for terms + privacy (always) and marketing
--     (always — accepted=true if opted-in, false otherwise; POPIA audit
--     wants both choices on record)
--   • profile_completed flips to true
--   • novice_registered_at set to current_date on first completion only
--     (coalesce-preserves the original date if the RPC ever re-runs)
--
-- statement_timeout 30s mirrors the migration-016 fix; SECURITY DEFINER
-- bypasses RLS for the multi-table write while the RPC re-derives the
-- caller from auth.uid() so it can only ever update its own profile.
--
-- Idempotent on (profile_id, kind, version) for consents — re-running with
-- the same versions is a no-op rather than an error.

create or replace function public.complete_player_profile(
  p_first_name        text,
  p_last_name         text,
  p_display_name      text,
  p_gender            public.gender,
  p_date_of_birth     date,
  p_bsa_number        text,
  p_dominant_hand     public.dominant_hand,
  p_phone             text,
  p_email_opt_in      boolean,
  p_club_grading      public.player_position,
  p_terms_version     text,
  p_privacy_version   text,
  p_marketing_version text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout to '30s'
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Profile fields ----------------------------------------------------------
  -- novice_registered_at: COALESCE preserves an existing date so re-runs
  -- never reset the novice window. nullif() collapses empty strings to NULL
  -- for optional text columns (bsa_number, phone, display_name).
  update public.profiles
     set first_name           = p_first_name,
         last_name            = p_last_name,
         display_name         = nullif(trim(coalesce(p_display_name, '')), ''),
         gender               = p_gender,
         date_of_birth        = p_date_of_birth,
         bsa_number           = nullif(trim(coalesce(p_bsa_number, '')), ''),
         dominant_hand        = p_dominant_hand,
         phone                = nullif(trim(coalesce(p_phone, '')), ''),
         email_opt_in         = p_email_opt_in,
         profile_completed    = true,
         novice_registered_at = coalesce(novice_registered_at, current_date)
   where id = v_user;

  -- Club grading on the player's primary membership ------------------------
  -- The partial unique index club_memberships_one_primary guarantees at
  -- most one is_primary row per profile. Players reach this RPC after
  -- accepting an invite (which creates an is_primary=true membership), so
  -- a row almost always exists. If none does (super-admin or club-admin
  -- transiting /me/setup), the UPDATE is a harmless no-op.
  update public.club_memberships
     set club_grading = p_club_grading
   where profile_id = v_user
     and is_primary = true;

  -- Consents — POPIA audit trail -------------------------------------------
  -- One row per (profile, kind, version). on conflict do nothing keeps the
  -- RPC idempotent under retries with the same versions.
  insert into public.consents (profile_id, kind, version, accepted)
  values
    (v_user, 'terms',     p_terms_version,     true),
    (v_user, 'privacy',   p_privacy_version,   true),
    (v_user, 'marketing', p_marketing_version, p_email_opt_in)
  on conflict (profile_id, kind, version) do nothing;
end;
$$;

grant execute on function public.complete_player_profile(
  text, text, text, public.gender, date, text, public.dominant_hand,
  text, boolean, public.player_position, text, text, text
) to authenticated;
