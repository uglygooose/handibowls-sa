-- Phase 2 / Migration 012 — consents (POPIA)
-- One row per consent acceptance. Versioned so we can re-prompt when T&Cs
-- or privacy policy change. Marketing consent is separate and opt-in.

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind consent_type not null,
  version text not null,
  accepted boolean not null default true,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint consents_unique_per_version unique (profile_id, kind, version)
);

create index consents_profile_kind_idx on public.consents (profile_id, kind);

-- RLS ------------------------------------------------------------------------
alter table public.consents enable row level security;

create policy consents_super_admin_all on public.consents
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy consents_self_insert on public.consents
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy consents_self_read on public.consents
  for select to authenticated
  using (profile_id = auth.uid());

-- Club-admin can read consents of their members (for POPIA audit).
create policy consents_club_admin_read on public.consents
  for select to authenticated
  using (
    public.current_role() = 'club_admin'
    and exists (
      select 1 from public.club_memberships cm
       where cm.profile_id = consents.profile_id
         and cm.club_id = any(public.current_club_ids())
    )
  );
