-- Phase 5e / Migration 020 — set_primary_membership RPC
--
-- Atomic primary-club toggle for dual-club players. Used by the top-bar
-- ClubSwitcher and the /me primary-toggle UI. Two writes inside one
-- transaction:
--   1. clear the caller's existing is_primary=true membership (if any)
--   2. set the chosen membership to is_primary=true
--
-- The partial unique index club_memberships_one_primary enforces "at most
-- one primary per profile" — two concurrent writes can't both succeed,
-- so wrapping in a single transaction is the necessary atomicity.
--
-- SECURITY DEFINER bypasses RLS for the multi-row write; the function
-- re-derives the caller from auth.uid() and verifies the target membership
-- belongs to them before mutating.

create or replace function public.set_primary_membership(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout to '30s'
as $$
declare
  v_user uuid := auth.uid();
  v_owns boolean;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Ownership gate inside the SECURITY DEFINER body — RLS is bypassed so
  -- this is the only thing stopping a malicious caller from flipping
  -- another user's primary club.
  select exists(
    select 1 from public.club_memberships
     where id = p_membership_id
       and profile_id = v_user
       and status = 'active'
  ) into v_owns;

  if not v_owns then
    raise exception 'Not your membership' using errcode = '42501';
  end if;

  update public.club_memberships
     set is_primary = false
   where profile_id = v_user
     and is_primary = true;

  update public.club_memberships
     set is_primary = true
   where id = p_membership_id;
end;
$$;

grant execute on function public.set_primary_membership(uuid) to authenticated;
