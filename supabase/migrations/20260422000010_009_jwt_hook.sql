-- Phase 2 / Migration 009 — JWT custom access token hook
-- Attaches `role` and `club_ids` to `app_metadata` on every access-token
-- issue. Registered in Supabase Dashboard → Auth → Hooks → Custom access
-- token (manual step). RLS helpers in 010 read these claims.
--
-- club_ids is the UNION of active memberships + admin assignments, so a
-- club-admin with no player membership still gets scoped access to their
-- admin club(s), and a player in 2+ clubs gets both.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  claims      jsonb := event -> 'claims';
  v_user_id   uuid  := (event ->> 'user_id')::uuid;
  v_role      user_role;
  v_club_ids  uuid[];
begin
  select role into v_role from public.profiles where id = v_user_id;

  select coalesce(array_agg(distinct club_id), '{}'::uuid[])
  into v_club_ids
  from (
    select club_id
      from public.club_admin_assignments
     where profile_id = v_user_id
    union
    select club_id
      from public.club_memberships
     where profile_id = v_user_id
       and status = 'active'
  ) c;

  if claims ? 'app_metadata' then
    claims := jsonb_set(
      claims,
      '{app_metadata,role}',
      to_jsonb(coalesce(v_role::text, 'player'))
    );
    claims := jsonb_set(
      claims,
      '{app_metadata,club_ids}',
      to_jsonb(coalesce(v_club_ids, '{}'::uuid[]))
    );
  else
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      jsonb_build_object(
        'role',     coalesce(v_role::text, 'player'),
        'club_ids', coalesce(v_club_ids, '{}'::uuid[])
      )
    );
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- The Supabase auth service runs as `supabase_auth_admin`. It must be able
-- to execute the hook and read the supporting tables.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on public.profiles                to supabase_auth_admin;
grant select on public.club_admin_assignments  to supabase_auth_admin;
grant select on public.club_memberships        to supabase_auth_admin;
