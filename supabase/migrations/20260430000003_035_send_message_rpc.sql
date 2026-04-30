-- Phase 11 / Migration 035 — public.send_message(p_message_id uuid) RPC
--
-- Phase 11 plan §14 step 3: "Fans out into message_recipients +
-- notifications." Revised Phase 11 drops the Resend / batched email
-- path entirely — admin-composed messages are in-app only — so the
-- fan-out collapses to pure DB writes done atomically inside a
-- single SECURITY DEFINER function.
--
-- Why pl/pgsql RPC, not a Deno Edge Function
--
--   The original plan called for an Edge Function because the
--   email path needed batched HTTP calls to Resend. Without those,
--   the fan-out is N inserts plus a status update — an Edge
--   Function would add a cold-start tax, force the caller to
--   manage a service-role key, and trade transactional atomicity
--   for HTTP semantics. A pl/pgsql RPC keeps everything in one
--   transaction: if any insert fails, the messages.status doesn't
--   strand in 'queued'; if the audience resolves to zero, the
--   row still transitions cleanly. Mirrors migrations 030/031's
--   SECURITY DEFINER patterns exactly.
--
-- Status state machine
--
--   draft   → still being composed; cannot be sent
--   queued  → ready to send (the only valid pre-send state); can
--             also be set by a future scheduler when scheduled_at
--             elapses
--   sent    → terminal success
--   failed  → terminal failure (validation or audience error)
--
--   The RPC accepts only 'queued'. The compose UI in 11-3 will
--   transition draft → queued in the same server action that calls
--   send_message. This keeps the contract sharp: by the time
--   send_message runs, the row has already passed the compose
--   action's own validation.
--
-- Idempotency on terminal states
--
--   Re-call on 'sent' or 'failed' returns ok=true without
--   re-fanning. message_recipients has a UNIQUE(message_id,
--   profile_id) constraint, so even if idempotency leaked an
--   accidental re-run we'd ON CONFLICT DO NOTHING our way through
--   it without duplicate rows. notifications has no such
--   constraint, so the short-circuit is the actual guard.
--
-- Failure semantics
--
--   Validation errors (audience kind invalid, tournament_id null
--   when required) DO NOT raise — they UPDATE status='failed' and
--   RETURN ok=false. Raising would roll back the status update and
--   strand the row in 'queued', defeating the brief's "queued →
--   failed on error" contract. Genuine constraint violations
--   (FK cascades during inserts) DO propagate (rollback) — those
--   represent code bugs, not validation outcomes.
--
-- Authorization
--
--   • super_admin                — always allowed
--   • club_admin owning club_id  — allowed
--   • anyone else                — 42501 insufficient_privilege
--
--   SECURITY DEFINER bypasses RLS for the inserts; the in-function
--   auth check IS the authorization. Mirrors migration 031.
--
-- Audience resolution
--
--   all_members         → distinct active profiles in
--                         club_memberships at the message's club
--   tournament_entrants → UNION of:
--                           - tournament_entries.profile_id (the
--                             singleton-player path used by singles)
--                           - tournament_team_members.profile_id via
--                             tournament_teams (team disciplines)
--                         excluding withdrawn entries/teams
--   custom              → audience_profile_ids verbatim, but
--                         intersected with active club members so a
--                         compromised audience array can't broadcast
--                         to non-members
--
-- Notification body truncation
--
--   notifications.body gets the first 280 chars of body_md. Twitter-
--   ish length is enough for inbox preview without dragging realtime
--   payloads. The full body lives in messages.body_md and the inbox
--   surfaces it via messages.body_md when the user opens the row.
--   No markdown stripping in pl/pgsql — the inbox _data.ts already
--   has a previewFromMarkdown helper for the messages stream;
--   notifications surface raw body_md and the bell will render it
--   collapsed.
--
-- Out of scope
--
--   • Daily broadcast cap enforcement — column unused per migration
--     034 / locked decision #4.
--   • Resend HTTP fan-out — dropped from Phase 11.
--   • Webhook-status update — dropped from Phase 11.
--   • Scheduled-send dispatcher — future phase. send_message itself
--     is scheduler-friendly (any scheduler that elapsed scheduled_at
--     can call this RPC).

create or replace function public.send_message(p_message_id uuid)
returns table (recipient_count integer, status text)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_role user_role;
  v_message public.messages;
  v_recipients uuid[];
  v_count integer;
begin
  if v_user is null then
    raise exception 'send_message: not_authenticated'
      using errcode = '42501';
  end if;

  v_role := public.current_role();
  if v_role not in ('club_admin', 'super_admin') then
    raise exception 'send_message: insufficient_role'
      using errcode = '42501';
  end if;

  select * into v_message from public.messages where id = p_message_id;

  if v_message.id is null then
    raise exception 'send_message: not_found'
      using errcode = 'P0002';
  end if;

  -- Authorization: club_admin must own the message's club.
  if v_role = 'club_admin'
     and not (v_message.club_id = ANY (public.current_club_ids())) then
    raise exception 'send_message: wrong_club'
      using errcode = '42501';
  end if;

  -- Idempotent short-circuit on terminal states. Mirrors the
  -- player flush idempotency pattern from Phase 8d.
  if v_message.status in ('sent', 'failed') then
    return query select
      v_message.recipient_count,
      v_message.status::text;
    return;
  end if;

  -- Pre-send state guard. Only 'queued' transitions to sent/failed
  -- via this RPC. 'draft' is rejected — the compose action must
  -- transition draft→queued before invoking us.
  if v_message.status <> 'queued' then
    raise exception 'send_message: wrong_state'
      using errcode = '22023';
  end if;

  -- Resolve audience. Validation errors transition to 'failed' and
  -- return ok=false rather than raise, per the brief's failure
  -- semantics. Genuine constraint violations during the inserts
  -- below DO raise (rollback) — those are bugs, not validation.
  begin
    if v_message.audience_kind = 'all_members' then
      select array_agg(distinct cm.profile_id) into v_recipients
        from public.club_memberships cm
       where cm.club_id = v_message.club_id
         and cm.status = 'active';

    elsif v_message.audience_kind = 'tournament_entrants' then
      if v_message.audience_tournament_id is null then
        update public.messages
           set status = 'failed', updated_at = now()
         where id = p_message_id;
        return query select 0, 'failed'::text;
        return;
      end if;
      select array_agg(distinct profile_id) into v_recipients
        from (
          select te.profile_id
            from public.tournament_entries te
           where te.tournament_id = v_message.audience_tournament_id
             and te.profile_id is not null
             and te.withdrawn = false
          union
          select ttm.profile_id
            from public.tournament_team_members ttm
            join public.tournament_teams tt on tt.id = ttm.team_id
           where tt.tournament_id = v_message.audience_tournament_id
             and tt.withdrawn = false
        ) x;

    elsif v_message.audience_kind = 'custom' then
      -- Intersect the supplied profile_ids with active club
      -- members so a compromised audience array (e.g. wrong RLS
      -- guard upstream) can't broadcast to non-members.
      select array_agg(distinct cm.profile_id) into v_recipients
        from public.club_memberships cm
       where cm.club_id = v_message.club_id
         and cm.status = 'active'
         and cm.profile_id = ANY (v_message.audience_profile_ids);

    else
      update public.messages
         set status = 'failed', updated_at = now()
       where id = p_message_id;
      return query select 0, 'failed'::text;
      return;
    end if;
  exception when others then
    update public.messages
       set status = 'failed', updated_at = now()
     where id = p_message_id;
    raise;
  end;

  v_recipients := coalesce(v_recipients, '{}'::uuid[]);
  v_count := coalesce(array_length(v_recipients, 1), 0);

  -- Fan out. Both inserts in the same transaction as the status
  -- transition below — atomic.
  insert into public.message_recipients (
    message_id, profile_id, sent_at, in_app_status
  )
  select
    p_message_id, p, now(), 'unread'::message_recipient_status
  from unnest(v_recipients) as p
  on conflict (message_id, profile_id) do nothing;

  insert into public.notifications (
    profile_id, club_id, kind, title, body, related_kind, related_id
  )
  select
    p,
    v_message.club_id,
    'broadcast',
    v_message.subject,
    case
      when v_message.body_md is null then null
      when length(v_message.body_md) <= 280 then v_message.body_md
      else substring(v_message.body_md from 1 for 277) || '...'
    end,
    'message',
    p_message_id
  from unnest(v_recipients) as p;

  -- Transition status. recipient_count carries the actual fan-out
  -- size — useful for the admin list page even when the audience
  -- query returned zero (e.g. tournament with no entrants yet).
  update public.messages
     set status = 'sent',
         sent_at = now(),
         recipient_count = v_count,
         updated_at = now()
   where id = p_message_id;

  return query select v_count, 'sent'::text;
end;
$$;

revoke all on function public.send_message(uuid) from public;
grant execute on function public.send_message(uuid) to authenticated;

comment on function public.send_message(uuid) is
  'Phase 11 fan-out RPC. Resolves a queued message''s audience '
  '(all_members | tournament_entrants | custom) and writes one '
  'message_recipients row + one notifications row per profile, then '
  'transitions messages.status from queued to sent (or failed on '
  'audience-resolution error). SECURITY DEFINER — caller must be '
  'club_admin owning the message''s club, or super_admin. '
  'Idempotent on terminal states. In-app channel only in v1; '
  'send_email is ignored.';
