-- Phase 4c.6 / Migration 016 — hoist statement_timeout on create_club_with_dependencies
--
-- Root cause: migration 014 defines create_club_with_dependencies without a
-- function-level statement_timeout. Over PostgREST HTTP the RPC runs inside
-- an `authenticated`-role session, which inherits Supabase's 5s role-level
-- default, and under cold-invocation / first-connection planning the body's
-- 17+ inserts (clubs → greens → rinks → invites) can exceed 5s — Postgres
-- aborts with SQLSTATE 57014 ("canceling statement due to statement timeout").
-- Direct psql (as postgres/supabase_admin) has no such cap, so the 40/40
-- integration suite passes; only the E2E wizard path over PostgREST trips it.
--
-- Fix: PostgREST 12.2+ hoists function-definition SET clauses into a
-- per-transaction setting when the RPC is invoked. Adding
--   `set statement_timeout to '30s'`
-- to the function header scopes the relaxed limit to this RPC alone. The
-- authenticated role's 5s default is untouched and continues to defend
-- against runaway queries in every other code path.
--
-- Idempotency: CREATE OR REPLACE with identical signature + body as
-- migration 014, plus the new SET clause. Replaying the migration
-- reproduces identical state. GRANT/REVOKE are preserved by
-- CREATE OR REPLACE but re-asserted here so this file is a self-contained
-- declaration of truth. No `NOTIFY pgrst, 'reload config'` needed —
-- PostgREST reads pg_proc.proconfig directly, not from its cache.

create or replace function public.create_club_with_dependencies(
  p_name           text,
  p_short_name     text,
  p_slug           text,
  p_district_id    uuid,
  p_city           text,
  p_contact_email  text,
  p_contact_phone  text,
  p_logo_path      text,
  p_theme_preset   club_theme_preset,
  p_admin_email    text,
  p_greens         jsonb,
  p_player_emails  text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
set statement_timeout to '30s'
as $$
declare
  v_actor_id  uuid := auth.uid();
  v_club_id   uuid;
  v_green_id  uuid;
  v_green     jsonb;
  v_green_name text;
  v_rink_count int;
  v_rink_idx  int;
  v_email     text;
begin
  if public.current_role() is distinct from 'super_admin' then
    raise exception 'create_club_with_dependencies: super_admin role required'
      using errcode = '42501';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'create_club_with_dependencies: name required' using errcode = '22004';
  end if;
  if p_slug is null or length(trim(p_slug)) = 0 then
    raise exception 'create_club_with_dependencies: slug required' using errcode = '22004';
  end if;
  if p_district_id is null then
    raise exception 'create_club_with_dependencies: district_id required' using errcode = '22004';
  end if;
  if p_city is null or length(trim(p_city)) = 0 then
    raise exception 'create_club_with_dependencies: city required' using errcode = '22004';
  end if;
  if p_admin_email is null or length(trim(p_admin_email)) = 0 then
    raise exception 'create_club_with_dependencies: admin_email required' using errcode = '22004';
  end if;
  if p_greens is null or jsonb_typeof(p_greens) <> 'array' then
    raise exception 'create_club_with_dependencies: greens must be a jsonb array' using errcode = '22004';
  end if;

  insert into public.clubs (
    name, short_name, slug, district_id, city,
    contact_email, contact_phone, logo_url, theme_preset
  )
  values (
    p_name,
    nullif(trim(p_short_name), ''),
    p_slug,
    p_district_id,
    p_city,
    nullif(trim(p_contact_email), ''),
    nullif(trim(p_contact_phone), ''),
    nullif(trim(p_logo_path), ''),
    p_theme_preset
  )
  returning id into v_club_id;

  for v_green in select * from jsonb_array_elements(p_greens)
  loop
    v_green_name := nullif(trim(v_green ->> 'name'), '');
    v_rink_count := (v_green ->> 'rink_count')::int;

    if v_green_name is null then
      raise exception 'create_club_with_dependencies: each green must have a name' using errcode = '22004';
    end if;
    if v_rink_count is null or v_rink_count < 1 or v_rink_count > 12 then
      raise exception 'create_club_with_dependencies: rink_count must be between 1 and 12 (got %)', v_rink_count
        using errcode = '22004';
    end if;

    insert into public.greens (club_id, name, rink_count)
    values (v_club_id, v_green_name, v_rink_count)
    returning id into v_green_id;

    for v_rink_idx in 1..v_rink_count loop
      insert into public.rinks (green_id, number) values (v_green_id, v_rink_idx);
    end loop;
  end loop;

  insert into public.invites (club_id, invited_by, email, role)
  values (v_club_id, v_actor_id, lower(trim(p_admin_email)), 'club_admin');

  if p_player_emails is not null then
    foreach v_email in array p_player_emails loop
      if v_email is null or length(trim(v_email)) = 0 then
        continue;
      end if;
      insert into public.invites (club_id, invited_by, email, role)
      values (v_club_id, v_actor_id, lower(trim(v_email)), 'player');
    end loop;
  end if;

  return v_club_id;
end;
$$;

revoke all on function public.create_club_with_dependencies(
  text, text, text, uuid, text, text, text, text, club_theme_preset, text, jsonb, text[]
) from public;

grant execute on function public.create_club_with_dependencies(
  text, text, text, uuid, text, text, text, text, club_theme_preset, text, jsonb, text[]
) to authenticated;
