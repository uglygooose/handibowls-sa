-- Phase 12 / 12-1 followup / Migration 038 — Twenty 20 assessment loop RPC fixes
--
-- Migration 037 shipped two RPCs with latent SQL bugs that ddl-time
-- didn't catch but runtime did (surfaced via the integration suite
-- in tests/rpc/t20-assessment-loop.test.ts):
--
--   1. request_t20_assessment
--      • `on conflict (message_id, profile_id)` referenced
--        `message_id`, which collided with the function's RETURNS
--        TABLE column of the same name (pl/pgsql treats those as
--        OUT-style locals). Postgres returned 42702 ambiguous-column.
--        Fix: drop the ON CONFLICT clause — v_admin_ids is
--        `array_agg(distinct ...)` and the message_id is freshly
--        inserted in the same transaction, so no conflict is
--        possible. Removing the clause removes the ambiguity site
--        entirely.
--      • `coalesce((select recipient_count from messages ...), 0)`
--        had the same ambiguity on `recipient_count`. Fix: alias
--        the messages table as `m` and qualify `m.recipient_count`.
--
--   2. admin_schedule_t20_assessment
--      • `select r.club_id from public.rinks r ...` — the rinks
--        table has no `club_id` column (the FK chain is
--        rinks → greens → club_id). Postgres returned 42703
--        undefined-column. Fix: read `g.club_id` from the joined
--        greens table.
--
-- DROP + CREATE rather than CREATE OR REPLACE so the function body
-- can be rewritten cleanly without any in-place ambiguity. Function
-- signatures (parameter list + return type) are preserved.

drop function if exists public.request_t20_assessment(uuid);
drop function if exists public.admin_schedule_t20_assessment(uuid, uuid, timestamptz, timestamptz, text);

create function public.request_t20_assessment(p_club_id uuid)
returns table (kind text, message_id uuid, recipient_count integer)
language plpgsql
security definer
set search_path = public, pg_catalog
as $func$
declare
  v_user uuid := auth.uid();
  v_membership_status text;
  v_player_name text;
  v_club_name text;
  v_admin_ids uuid[];
  v_existing_id uuid;
  v_existing_count integer;
  v_message_id uuid;
  v_subject text;
  v_body_md text;
begin
  if v_user is null then
    return query select 'not_authenticated'::text, null::uuid, 0;
    return;
  end if;

  select cm.status into v_membership_status
    from public.club_memberships cm
   where cm.profile_id = v_user
     and cm.club_id = p_club_id;

  if v_membership_status is null or v_membership_status <> 'active' then
    return query select 'wrong_club'::text, null::uuid, 0;
    return;
  end if;

  select
    coalesce(
      nullif(p.display_name, ''),
      nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
      'A member'
    )
  into v_player_name
    from public.profiles p
   where p.id = v_user;

  select c.name into v_club_name
    from public.clubs c
   where c.id = p_club_id;

  v_subject := 'Twenty 20 assessment request — ' || v_player_name;

  select m.id, m.recipient_count
    into v_existing_id, v_existing_count
    from public.messages m
   where m.sender_id = v_user
     and m.club_id = p_club_id
     and m.subject = v_subject
     and m.status = 'sent'
     and m.sent_at > now() - interval '24 hours'
   order by m.sent_at desc
   limit 1;

  if v_existing_id is not null then
    return query select 'throttled'::text, v_existing_id, coalesce(v_existing_count, 0);
    return;
  end if;

  select array_agg(distinct caa.profile_id) into v_admin_ids
    from public.club_admin_assignments caa
   where caa.club_id = p_club_id;

  if v_admin_ids is null or cardinality(v_admin_ids) = 0 then
    return query select 'no_admins'::text, null::uuid, 0;
    return;
  end if;

  v_body_md :=
    v_player_name || ' has requested a Twenty 20 assessment at ' ||
    coalesce(v_club_name, 'your club') || E'.\n\n' ||
    'Reply by scheduling a slot — there''s a "Schedule from this request" button on this message that pre-fills the booking form.';

  insert into public.messages (
    sender_id, club_id, subject, body_md, send_in_app, send_email,
    audience_kind, audience_profile_ids, status, sent_at, recipient_count
  ) values (
    v_user, p_club_id, v_subject, v_body_md, true, false,
    'custom', v_admin_ids, 'sent', now(), cardinality(v_admin_ids)
  )
  returning id into v_message_id;

  -- v_admin_ids comes from array_agg(distinct ...) and v_message_id
  -- was just minted, so the (message_id, profile_id) unique pair is
  -- guaranteed novel — no ON CONFLICT clause needed.
  insert into public.message_recipients (message_id, profile_id, in_app_status, sent_at)
  select v_message_id, admin_id, 'unread', now()
    from unnest(v_admin_ids) as admin_id;

  insert into public.notifications (
    profile_id, club_id, kind, title, body, related_kind, related_id
  )
  select
    admin_id, p_club_id, 't20_assessment_request', v_subject,
    left(v_body_md, 280), 'message', v_message_id
    from unnest(v_admin_ids) as admin_id;

  return query select 'ok'::text, v_message_id, cardinality(v_admin_ids);
end;
$func$;

revoke all on function public.request_t20_assessment(uuid) from public;
grant execute on function public.request_t20_assessment(uuid) to authenticated;

comment on function public.request_t20_assessment(uuid) is
  'Player-initiated Twenty 20 assessment request. Composes a message to the club admins, fans out to message_recipients + notifications, soft-throttles repeat requests within 24h.';

create function public.admin_schedule_t20_assessment(
  p_player_id uuid,
  p_rink_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null
)
returns table (kind text, booking_id uuid)
language plpgsql
security definer
set search_path = public, pg_catalog
as $func$
declare
  v_user uuid := auth.uid();
  v_role user_role;
  v_club_id uuid;
  v_membership_status text;
  v_booking_id uuid;
  v_player_name text;
  v_rink_label text;
begin
  if v_user is null then
    return query select 'not_authenticated'::text, null::uuid;
    return;
  end if;

  v_role := public.current_role();
  if v_role <> 'club_admin' and v_role <> 'super_admin' then
    return query select 'wrong_role'::text, null::uuid;
    return;
  end if;

  if p_ends_at <= p_starts_at or p_starts_at < now() - interval '5 minutes' then
    return query select 'bad_input'::text, null::uuid;
    return;
  end if;

  -- rinks doesn't carry club_id directly; resolve via the green.
  select g.club_id into v_club_id
    from public.rinks r
    join public.greens g on g.id = r.green_id
   where r.id = p_rink_id;

  if v_club_id is null then
    return query select 'wrong_club'::text, null::uuid;
    return;
  end if;

  if v_role = 'club_admin' and not (v_club_id = any(public.current_club_ids())) then
    return query select 'wrong_club'::text, null::uuid;
    return;
  end if;

  select cm.status into v_membership_status
    from public.club_memberships cm
   where cm.profile_id = p_player_id
     and cm.club_id = v_club_id;

  if v_membership_status is null or v_membership_status <> 'active' then
    return query select 'wrong_player'::text, null::uuid;
    return;
  end if;

  begin
    insert into public.bookings (
      rink_id, club_id, booked_by, for_profile_id, purpose,
      starts_at, ends_at, status, notes
    ) values (
      p_rink_id, v_club_id, v_user, p_player_id, 't20_assessment',
      p_starts_at, p_ends_at, 'booked', p_notes
    )
    returning id into v_booking_id;
  exception
    when exclusion_violation then
      return query select 'slot_taken'::text, null::uuid;
      return;
  end;

  select
    coalesce(
      nullif(p.display_name, ''),
      nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
      'You'
    )
  into v_player_name
    from public.profiles p
   where p.id = p_player_id;

  select g.name || ' · Rink ' || r.number into v_rink_label
    from public.rinks r
    join public.greens g on g.id = r.green_id
   where r.id = p_rink_id;

  insert into public.notifications (
    profile_id, club_id, kind, title, body, related_kind, related_id
  ) values (
    p_player_id, v_club_id, 't20_assessment_scheduled',
    'Twenty 20 assessment scheduled',
    'Your Twenty 20 assessment is booked for ' ||
      to_char(p_starts_at at time zone 'Africa/Johannesburg', 'DD Mon YYYY · HH24:MI') ||
      ' at ' || coalesce(v_rink_label, 'your club') || '.',
    'booking', v_booking_id
  );

  return query select 'ok'::text, v_booking_id;
end;
$func$;

revoke all on function public.admin_schedule_t20_assessment(uuid, uuid, timestamptz, timestamptz, text) from public;
grant execute on function public.admin_schedule_t20_assessment(uuid, uuid, timestamptz, timestamptz, text) to authenticated;

comment on function public.admin_schedule_t20_assessment(uuid, uuid, timestamptz, timestamptz, text) is
  'Admin-initiated Twenty 20 assessment scheduling. Inserts a booking with purpose=t20_assessment and fires a player notification in the same transaction. Returns slot_taken on overlap conflict.';
