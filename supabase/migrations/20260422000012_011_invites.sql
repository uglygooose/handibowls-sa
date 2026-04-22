-- Phase 2 / Migration 011 — invites
-- Email-based invites with a 14-day expiry. Token is a url-safe random
-- string. Resolved at `/invite/[token]`: matches the row, sets password,
-- creates auth.users + profiles via trigger, creates the club_membership
-- (or admin assignment) implied by the invite.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  email text not null,
  role user_role not null default 'player',
  token text not null default encode(gen_random_bytes(24), 'hex'),
  status invite_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_profile_id uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invites_token_unique unique (token),
  constraint invites_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create index invites_club_id_idx on public.invites (club_id);
create index invites_email_idx on public.invites (lower(email));
create index invites_status_expires_idx on public.invites (status, expires_at);

create trigger invites_set_updated_at
  before update on public.invites
  for each row execute function public.set_updated_at();

-- RLS ------------------------------------------------------------------------
alter table public.invites enable row level security;

create policy invites_super_admin_all on public.invites
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy invites_club_admin_rw on public.invites
  for all to authenticated
  using (
    public.current_role() = 'club_admin'
    and club_id = any(public.current_club_ids())
  )
  with check (
    public.current_role() = 'club_admin'
    and club_id = any(public.current_club_ids())
  );

-- Invite recipients can fetch their own row by email to show status (rarely
-- used — primary path is token lookup by a public RPC).
create policy invites_self_email_read on public.invites
  for select to authenticated
  using (
    lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
