-- Phase 4a / Migration 015 — club-logos Storage bucket + RLS
--
-- Public-read bucket used by the super-admin wizard, the club-admin settings
-- surface, and any marketing/shell surface that renders a club logo. Writes
-- are restricted to super-admins and the owning club's club-admins.
--
-- Path convention: `club-logos/<clubId>/<filename>`. The leading path segment
-- is the club UUID, so write policies can extract it and match against the
-- caller's club_ids claim.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'club-logos',
  'club-logos',
  true,
  2 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
   set public = excluded.public,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- Policies on storage.objects. RLS on storage.objects is enabled by default
-- in Supabase; we just add scoped policies. Drop first so the migration is
-- re-runnable under `supabase db reset`.
drop policy if exists "club_logos_public_read" on storage.objects;
drop policy if exists "club_logos_super_admin_write" on storage.objects;
drop policy if exists "club_logos_club_admin_write" on storage.objects;

create policy "club_logos_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'club-logos');

create policy "club_logos_super_admin_write"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'club-logos'
    and public.current_role() = 'super_admin'
  )
  with check (
    bucket_id = 'club-logos'
    and public.current_role() = 'super_admin'
  );

-- Club-admin scoped write: match the first path segment (club id) against
-- the caller's current_club_ids() claim. storage.foldername(name) returns
-- the path split on '/', so foldername[1] is the first segment.
create policy "club_logos_club_admin_write"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'club-logos'
    and public.current_role() = 'club_admin'
    and (storage.foldername(name))[1]::uuid = any (public.current_club_ids())
  )
  with check (
    bucket_id = 'club-logos'
    and public.current_role() = 'club_admin'
    and (storage.foldername(name))[1]::uuid = any (public.current_club_ids())
  );
