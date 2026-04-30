-- Phase 12 / 12-3 / Migration 040 — invites.email_status persistence + t20_assessment_scheduled related_kind
--
-- Two unrelated-looking changes bundled because they're both
-- one-DDL-statement-each and both unlock 12-3 application code:
--
--   1. invites.email_status / email_error / email_sent_at
--      Phase 11 / 11-4 added the sendInviteEmail helper that returns
--      a discriminated SendInviteEmailResult — but the result is only
--      surfaced as a toast at creation time. The invite row itself
--      stores no record of whether the email landed. 12-3 needs to
--      surface a "Resend invite" button on rows where the previous
--      send failed or was skipped (POPIA opt-out), so the status has
--      to persist on the invite row. Three nullable columns (NULL =
--      not yet attempted) preserve backwards compatibility with the
--      existing set of invite rows.
--
--   2. admin_schedule_t20_assessment writes related_kind='t20_assessment'
--      Notification rows fired by the RPC have the bell looking up
--      relatedHref by related_kind. With kind='booking' the bell
--      routes to /book — wrong target for a Twenty 20 assessment
--      booking. Changing the literal to 't20_assessment' lets the
--      bell distinguish without an extra roundtrip to fetch the
--      booking's purpose. CREATE OR REPLACE preserves the function
--      signature (12-3 application code reads from the same RPC).
--
--      No notifications row migration needed — existing rows fired
--      since 12-1 followup carry related_kind='booking' but don't
--      need backfill. The bell's player-side handler treats
--      related_kind='booking' as rink-reservation (existing
--      behaviour); future t20-scheduled notifications will carry
--      't20_assessment' and route to /t20.

-- ---------------------------------------------------------------------
-- 1. invites.email_status / email_error / email_sent_at
-- ---------------------------------------------------------------------

alter table public.invites
  add column if not exists email_status text,
  add column if not exists email_error text,
  add column if not exists email_sent_at timestamptz;

-- Allowed values match the SendInviteEmailResult discriminated union
-- at lib/invites/email.ts. NULL means "send not yet attempted" — the
-- 12-3 Resend button uses this to render its CTA on every pending
-- invite row that lacks a successful 'sent' status.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'invites_email_status_allowed'
       and conrelid = 'public.invites'::regclass
  ) then
    alter table public.invites
      add constraint invites_email_status_allowed
      check (email_status is null or email_status in ('sent', 'skipped', 'failed'));
  end if;
end$$;

comment on column public.invites.email_status is
  'Most-recent send attempt result. NULL = not yet attempted; ''sent'' = '
  'delivered to Resend; ''skipped'' = recipient opted out at send time; '
  '''failed'' = render error or Resend HTTP failure.';
comment on column public.invites.email_error is
  'Free-text error from the most-recent failed send. NULL when the '
  'last attempt succeeded or hasn''t fired.';
comment on column public.invites.email_sent_at is
  'Timestamp of the most-recent send attempt (success, skip, or '
  'failure). NULL until first attempt.';

-- ---------------------------------------------------------------------
-- 2. admin_schedule_t20_assessment writes related_kind='t20_assessment'
-- ---------------------------------------------------------------------
--
-- Replaces the migration 037+038 body (CREATE OR REPLACE preserves
-- the existing function signature). Only the notification INSERT's
-- related_kind literal changes from 'booking' to 't20_assessment'.

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

  -- 12-3 change: related_kind='t20_assessment' (was 'booking') so the
  -- bell can route to /t20 directly without a booking-purpose lookup.
  insert into public.notifications (
    profile_id, club_id, kind, title, body, related_kind, related_id
  ) values (
    p_player_id, v_club_id, 't20_assessment_scheduled',
    'Twenty 20 assessment scheduled',
    'Your Twenty 20 assessment is booked for ' ||
      to_char(p_starts_at at time zone 'Africa/Johannesburg', 'DD Mon YYYY · HH24:MI') ||
      ' at ' || coalesce(v_rink_label, 'your club') || '.',
    't20_assessment', v_booking_id
  );

  return query select 'ok'::text, v_booking_id;
end;
$func$;
