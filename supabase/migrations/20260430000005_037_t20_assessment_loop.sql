-- Phase 12 / 12-1 followup / Migration 037 — Twenty 20 assessment request → schedule loop
--
-- Builds on migration 036 (which committed the new
-- booking_purpose='t20_assessment' enum value). Three pieces:
--
--   1. bookings.for_profile_id        — the player a t20_assessment is FOR.
--                                       NULL for non-assessment bookings.
--                                       Distinct from booked_by (= the admin
--                                       who scheduled it). Indexed for the
--                                       /t20 "Upcoming assessments" filter.
--
--   2. request_t20_assessment(...)    — player-callable SECURITY DEFINER
--                                       RPC that composes a custom-audience
--                                       message to the club's admins and
--                                       fans out into message_recipients +
--                                       notifications. Mirrors send_message
--                                       (migration 035) but accepts player
--                                       callers. Soft 24h cooldown.
--
--   3. admin_schedule_t20_assessment  — admin-callable SECURITY DEFINER RPC
--                                       that creates a booking with
--                                       purpose='t20_assessment' AND fires
--                                       a notification to the player in the
--                                       same transaction. Atomicity matters
--                                       — partial failure must not leave a
--                                       booking without its notification.
--
-- Authorization
--   • request_t20_assessment       — any authenticated profile that's an
--                                    active member of the target club
--   • admin_schedule_t20_assessment — caller must be a club_admin owning
--                                    the rink's club; player must be an
--                                    active member of that club
--
-- Out of scope
--   • Force-cancel for assessment bookings — admin_force_cancel_booking
--     (migration 031) already handles any booking by id. Reused as-is.
--   • Player-side cancel — cancel_own_booking (migration 030) only
--     covers booked_by = caller. For t20_assessments, booked_by = admin,
--     so players cannot self-cancel via that RPC. Intentional: the
--     admin scheduled it; the admin owns the lifecycle.

-- ---------------------------------------------------------------------
-- 1. bookings.for_profile_id column + check constraint + index
-- ---------------------------------------------------------------------

alter table public.bookings
  add column if not exists for_profile_id uuid
    references public.profiles(id) on delete set null;

-- Strict enforcement: purpose='t20_assessment' iff for_profile_id is NOT NULL.
-- Prevents two bug classes:
--   (a) admin scheduling an assessment without specifying who it's for
--   (b) leaking for_profile_id onto roll-up/practice rows where it's noise
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'bookings_t20_assessment_for_profile_id'
       and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_t20_assessment_for_profile_id
      check ((purpose = 't20_assessment') = (for_profile_id is not null));
  end if;
end$$;

create index if not exists bookings_for_profile_idx
  on public.bookings (for_profile_id)
  where for_profile_id is not null;

comment on column public.bookings.for_profile_id is
  'Player a t20_assessment booking is scheduled for. NULL for all '
  'other purposes. Strictly enforced via the '
  'bookings_t20_assessment_for_profile_id check constraint.';

-- ---------------------------------------------------------------------
-- 2. request_t20_assessment RPC
-- ---------------------------------------------------------------------
--
-- Result kinds
--   ok                   — message dispatched to N admins
--   throttled            — caller already requested within last 24h
--   no_admins            — club has no admin assignments (UI: contact
--                          super-admin)
--   wrong_club           — caller is not an active member of p_club_id
--   not_authenticated    — auth.uid() is null (shouldn't happen via
--                          server action gating, but defended in depth)

create or replace function public.request_t20_assessment(p_club_id uuid)
returns table (kind text, message_id uuid, recipient_count integer)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_membership_status text;
  v_player_name text;
  v_club_name text;
  v_admin_ids uuid[];
  v_existing_id uuid;
  v_message_id uuid;
  v_subject text;
  v_body_md text;
begin
  if v_user is null then
    return query select 'not_authenticated'::text, null::uuid, 0;
    return;
  end if;

  -- Validate club membership.
  select cm.status into v_membership_status
    from public.club_memberships cm
   where cm.profile_id = v_user
     and cm.club_id = p_club_id;

  if v_membership_status is null or v_membership_status <> 'active' then
    return query select 'wrong_club'::text, null::uuid, 0;
    return;
  end if;

  -- Compose the player display name from the profile.
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

  -- 24h soft cooldown — look for any 'sent' message authored by this
  -- player to this club with the locked subject prefix in the last 24h.
  -- The subject prefix is the request-detection signal admins key off.
  v_subject := 'Twenty 20 assessment request — ' || v_player_name;

  select m.id into v_existing_id
    from public.messages m
   where m.sender_id = v_user
     and m.club_id = p_club_id
     and m.subject = v_subject
     and m.status = 'sent'
     and m.sent_at > now() - interval '24 hours'
   order by m.sent_at desc
   limit 1;

  if v_existing_id is not null then
    return query select
      'throttled'::text,
      v_existing_id,
      coalesce(
        (select recipient_count from public.messages where id = v_existing_id),
        0
      );
    return;
  end if;

  -- Resolve admin recipients via club_admin_assignments.
  select array_agg(distinct caa.profile_id) into v_admin_ids
    from public.club_admin_assignments caa
   where caa.club_id = p_club_id;

  if v_admin_ids is null or cardinality(v_admin_ids) = 0 then
    return query select 'no_admins'::text, null::uuid, 0;
    return;
  end if;

  -- Compose the body. The subject prefix IS the detection signal for
  -- "Schedule from this request" — the body is plain text the admin
  -- reads inline. Include enough context that the admin can recognise
  -- the player + their current grade tier without leaving the inbox.
  v_body_md :=
    v_player_name || ' has requested a Twenty 20 assessment at ' ||
    coalesce(v_club_name, 'your club') || E'.\n\n' ||
    'Reply by scheduling a slot — there''s a "Schedule from this ' ||
    'request" button on this message that pre-fills the booking form.';

  -- Insert the message + fan out into message_recipients + notifications
  -- inside this transaction. status='sent' immediately because there's
  -- no scheduled_at semantics for player-initiated requests.
  insert into public.messages (
    sender_id,
    club_id,
    subject,
    body_md,
    send_in_app,
    send_email,
    audience_kind,
    audience_profile_ids,
    status,
    sent_at,
    recipient_count
  ) values (
    v_user,
    p_club_id,
    v_subject,
    v_body_md,
    true,
    false,
    'custom',
    v_admin_ids,
    'sent',
    now(),
    cardinality(v_admin_ids)
  )
  returning id into v_message_id;

  -- message_recipients fan-out.
  insert into public.message_recipients (message_id, profile_id, in_app_status, sent_at)
  select v_message_id, admin_id, 'unread', now()
    from unnest(v_admin_ids) as admin_id
  on conflict (message_id, profile_id) do nothing;

  -- notifications fan-out — first 280 chars of body for inbox preview.
  insert into public.notifications (
    profile_id,
    club_id,
    kind,
    title,
    body,
    related_kind,
    related_id
  )
  select
    admin_id,
    p_club_id,
    't20_assessment_request',
    v_subject,
    left(v_body_md, 280),
    'message',
    v_message_id
    from unnest(v_admin_ids) as admin_id;

  return query select 'ok'::text, v_message_id, cardinality(v_admin_ids);
end;
$$;

revoke all on function public.request_t20_assessment(uuid) from public;
grant execute on function public.request_t20_assessment(uuid) to authenticated;

comment on function public.request_t20_assessment(uuid) is
  'Player-initiated Twenty 20 assessment request. Composes a message '
  'to the club''s admins, fans out to message_recipients + '
  'notifications, soft-throttles repeat requests within 24h.';

-- ---------------------------------------------------------------------
-- 3. admin_schedule_t20_assessment RPC
-- ---------------------------------------------------------------------
--
-- Result kinds
--   ok                   — booking inserted, notification fired
--   wrong_role           — caller not a club_admin
--   wrong_club           — rink belongs to a club the caller does not admin
--   wrong_player         — player not an active member of the rink's club
--   slot_taken           — bookings_no_overlap GIST exclusion fired
--                          (another booking covers the rink+time range)
--   bad_input            — ends_at <= starts_at, or starts_at < now()
--   not_authenticated    — auth.uid() is null

create or replace function public.admin_schedule_t20_assessment(
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
as $$
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
    -- 5-minute grace lets clients send timestamps that round down to
    -- "now" without tripping bad_input on clock skew.
    return query select 'bad_input'::text, null::uuid;
    return;
  end if;

  -- Resolve rink → club.
  select r.club_id into v_club_id
    from public.rinks r
    join public.greens g on g.id = r.green_id
   where r.id = p_rink_id;

  if v_club_id is null then
    return query select 'wrong_club'::text, null::uuid;
    return;
  end if;

  -- Authorization: club_admin must own the rink's club. super_admin
  -- bypasses this check.
  if v_role = 'club_admin' and not (v_club_id = any(public.current_club_ids())) then
    return query select 'wrong_club'::text, null::uuid;
    return;
  end if;

  -- Validate player membership at the rink's club.
  select cm.status into v_membership_status
    from public.club_memberships cm
   where cm.profile_id = p_player_id
     and cm.club_id = v_club_id;

  if v_membership_status is null or v_membership_status <> 'active' then
    return query select 'wrong_player'::text, null::uuid;
    return;
  end if;

  -- Insert booking. Catch bookings_no_overlap exclusion violation and
  -- surface as 'slot_taken' rather than a raw 23P01.
  begin
    insert into public.bookings (
      rink_id,
      club_id,
      booked_by,
      for_profile_id,
      purpose,
      starts_at,
      ends_at,
      status,
      notes
    ) values (
      p_rink_id,
      v_club_id,
      v_user,
      p_player_id,
      't20_assessment',
      p_starts_at,
      p_ends_at,
      'booked',
      p_notes
    )
    returning id into v_booking_id;
  exception
    when exclusion_violation then
      return query select 'slot_taken'::text, null::uuid;
      return;
  end;

  -- Compose notification preview from booking context.
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
    profile_id,
    club_id,
    kind,
    title,
    body,
    related_kind,
    related_id
  ) values (
    p_player_id,
    v_club_id,
    't20_assessment_scheduled',
    'Twenty 20 assessment scheduled',
    'Your Twenty 20 assessment is booked for ' ||
      to_char(p_starts_at at time zone 'Africa/Johannesburg', 'DD Mon YYYY · HH24:MI') ||
      ' at ' || coalesce(v_rink_label, 'your club') || '.',
    'booking',
    v_booking_id
  );

  return query select 'ok'::text, v_booking_id;
end;
$$;

revoke all on function public.admin_schedule_t20_assessment(uuid, uuid, timestamptz, timestamptz, text) from public;
grant execute on function public.admin_schedule_t20_assessment(uuid, uuid, timestamptz, timestamptz, text) to authenticated;

comment on function public.admin_schedule_t20_assessment(uuid, uuid, timestamptz, timestamptz, text) is
  'Admin-initiated Twenty 20 assessment scheduling. Inserts a booking '
  'with purpose=''t20_assessment'' and fires a player notification in '
  'the same transaction. Returns ''slot_taken'' on overlap conflict.';
