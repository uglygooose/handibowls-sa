-- Phase 5c / Migration 018 — create_player_invites_batch RPC
--
-- Atomic, idempotent batch creation of player invites for a single club.
-- Mirrors create_club_with_dependencies' security model:
--   • SECURITY DEFINER bypasses RLS for the multi-row write
--   • Per-function `set statement_timeout to '30s'` (PostgREST 12.2+ pattern,
--     matches migration 016 fix) so the call doesn't trip the role-level
--     5-second authenticated default on slow cold-invocations
--   • Internal gate re-derives the caller's role + club_ids from the JWT and
--     refuses a club_admin attempting to invite to a club they don't own
--
-- "Idempotent on (club_id, lower(email))": if a pending player-invite already
-- exists for the same club + email, the row is returned with status='duplicate'
-- and the existing token — never a second pending invite. Also marks duplicate
-- when the email already corresponds to an active club_membership.
--
-- "Atomic": runs inside the caller's transaction; any error rolls the whole
-- batch back. There is no "partial commit" branch.
--
-- Input shape: jsonb array of {email, first_name?, last_name?}. Empty rows
-- are skipped silently (the caller's CSV preview should have removed them).

create type public.invite_batch_result as (
  email text,
  status text,
  invite_id uuid,
  token text
);

create or replace function public.create_player_invites_batch(
  p_club_id uuid,
  p_invites jsonb
)
returns setof public.invite_batch_result
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout to '30s'
as $$
declare
  v_role public.user_role;
  v_clubs uuid[];
  v_invitee jsonb;
  v_email text;
  v_first text;
  v_last text;
  v_existing_id uuid;
  v_existing_token text;
  v_new_id uuid;
  v_new_token text;
  v_caller uuid := auth.uid();
begin
  -- Auth gate ----------------------------------------------------------------
  v_role := public.current_role();
  v_clubs := public.current_club_ids();
  if v_role is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if v_role <> 'super_admin'
     and (v_role <> 'club_admin' or not (p_club_id = any (v_clubs))) then
    raise exception 'Not authorized to invite to this club' using errcode = '42501';
  end if;

  -- Per-row processing -------------------------------------------------------
  for v_invitee in select * from jsonb_array_elements(p_invites)
  loop
    v_email := lower(trim(coalesce(v_invitee->>'email', '')));
    if v_email = '' then
      continue;  -- defensive; client-side preview should already filter
    end if;
    v_first := nullif(trim(coalesce(v_invitee->>'first_name', '')), '');
    v_last  := nullif(trim(coalesce(v_invitee->>'last_name',  '')), '');

    -- Existing pending player-invite for this club?
    select id, token
      into v_existing_id, v_existing_token
      from public.invites
     where club_id = p_club_id
       and lower(email) = v_email
       and role = 'player'
       and status = 'pending'
     limit 1;

    if v_existing_id is not null then
      return next (v_email, 'duplicate', v_existing_id, v_existing_token)::public.invite_batch_result;
      continue;
    end if;

    -- Already a member?
    if exists (
      select 1
        from public.club_memberships cm
        join public.profiles p on p.id = cm.profile_id
       where cm.club_id = p_club_id
         and cm.status = 'active'
         and lower(p.email) = v_email
    ) then
      return next (v_email, 'duplicate', null, null)::public.invite_batch_result;
      continue;
    end if;

    -- New invite ------------------------------------------------------------
    insert into public.invites (club_id, email, role, first_name, last_name, invited_by)
         values (p_club_id, v_email, 'player', v_first, v_last, v_caller)
    returning id, token
         into v_new_id, v_new_token;

    return next (v_email, 'created', v_new_id, v_new_token)::public.invite_batch_result;
  end loop;
end;
$$;

grant execute on function public.create_player_invites_batch(uuid, jsonb) to authenticated;
