-- Phase 4a / Migration 014 — create_club_with_dependencies RPC
--
-- Atomic club creation for the super-admin wizard. One RPC, one transaction.
-- Inserts the club, its greens + rinks, and pending invites for the initial
-- club-admin and player members. Rolls back on any inner failure.
--
-- Security: SECURITY DEFINER so it can bypass per-table RLS, but gates on
-- public.current_role() = 'super_admin' and raises otherwise. GRANTed only to
-- authenticated — anon cannot call it.
--
-- Invites (not direct assignments): the admin and players receive `pending`
-- invite rows. They pick up at /invite/[token] where acceptInviteAction writes
-- the real club_admin_assignments / club_memberships row. This keeps the
-- identity side of the flow in one place.

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

  -- Club core. logo_path is stored on clubs.logo_url; we normalise the
  -- storage path into a full URL at render time (Phase 4b). Optional text
  -- fields are coerced from empty-string → NULL so the generated TS types
  -- can stay non-nullable at the RPC boundary.
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

  -- Greens + rinks. Each array entry: { "name": text, "rink_count": int }.
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

  -- Admin invite (one per club on creation; more can be added later via
  -- createInvite server action).
  insert into public.invites (club_id, invited_by, email, role)
  values (v_club_id, v_actor_id, lower(trim(p_admin_email)), 'club_admin');

  -- Player invites — optional array.
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
