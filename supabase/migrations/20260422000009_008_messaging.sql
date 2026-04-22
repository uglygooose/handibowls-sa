-- Phase 2 / Migration 008 — messaging
-- Club-admin broadcasts + player notifications. Channels: in_app (always)
-- and email (optional). No SMS per Q6. Fan-out from messages → recipients
-- happens in the Phase 11 edge function; this migration defines storage only.

-- Messages -------------------------------------------------------------------
-- A message is a club-admin broadcast. Audience can be all members, all
-- entrants of a tournament, or a custom profile_id list.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  body_md text not null,
  send_in_app boolean not null default true,
  send_email boolean not null default false,
  audience_kind text not null default 'all_members',
  audience_tournament_id uuid references public.tournaments(id) on delete set null,
  audience_profile_ids uuid[] not null default '{}',
  status message_status not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_audience_kind_allowed check (
    audience_kind in ('all_members', 'tournament_entrants', 'custom')
  )
);

create index messages_club_idx on public.messages (club_id);
create index messages_status_idx on public.messages (status);
create index messages_scheduled_at_idx on public.messages (scheduled_at);

create trigger messages_set_updated_at
  before update on public.messages
  for each row execute function public.set_updated_at();

-- Message recipients ---------------------------------------------------------
-- One row per (message × profile) pair after fan-out. Tracks per-channel
-- delivery + read state. email_status mirrors provider state (Resend).
create table public.message_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  email_address text,
  in_app_status message_recipient_status not null default 'unread',
  email_status text,
  read_at timestamptz,
  sent_at timestamptz,
  email_sent_at timestamptz,
  email_error text,
  created_at timestamptz not null default now(),
  constraint message_recipients_email_status_allowed check (
    email_status is null or email_status in ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed')
  ),
  constraint message_recipients_unique unique (message_id, profile_id)
);

create index message_recipients_profile_idx on public.message_recipients (profile_id);
create index message_recipients_message_idx on public.message_recipients (message_id);

-- Notifications --------------------------------------------------------------
-- Non-message system events (match reminders, booking confirmations,
-- tournament draws, T20 results, etc.). Subscribed via Supabase Realtime
-- channel `notifications:profile_id=eq.<id>`.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  related_kind text,
  related_id uuid,
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_read_idx
  on public.notifications (profile_id, read);
create index notifications_profile_created_idx
  on public.notifications (profile_id, created_at desc);
