-- Phase 13 / 13-2 / Batch C — Migration 042
-- Atomic activate_rubric_version RPC + activated_by column.
--
-- Closes DRIFT-L190: pre-RPC the activation flow was sequential
-- UPDATE+UPDATE in the application layer (`activateRubricVersion`
-- server action). Race window between the two UPDATEs is sub-
-- millisecond from a single request, but the partial unique index
-- `t20_rubric_versions_one_active` means a concurrent activator
-- could trip a unique violation. v1 risk is low (super-admin only,
-- infrequent operation) but the pattern matches Phase 9's
-- `cancel_own_booking` (030) + `admin_force_cancel_booking` (031)
-- — atomic SECURITY DEFINER RPC that wraps the multi-statement
-- transition in a single transaction.
--
-- Two changes in this migration:
--   1. Additive: t20_rubric_versions.activated_by column.
--      Audit-trail column to record which super_admin activated
--      each version. References profiles(id) ON DELETE SET NULL
--      (matching the `created_by` pattern on the same table —
--      activator history survives super_admin profile removal).
--      Existing rows backfill to null (matches activated_at on
--      pre-migration rows).
--   2. New function: public.activate_rubric_version(p_version_id uuid).
--      SECURITY DEFINER, super_admin-only (verified inside body),
--      grants execute to authenticated, REVOKE'd from PUBLIC.
--      Wraps the deactivate-current + activate-target + audit-log
--      writes in a single transaction. Uses pg_advisory_xact_lock
--      to serialise concurrent activators (the partial unique
--      index would catch the race after the fact, but the
--      advisory lock prevents the unique violation entirely).
--
-- The action wrapper at app/(super-admin)/platform/rubrics/_actions.ts
-- is rewired in Batch C3. This migration ships as its own atomic
-- commit per the L55 two-commit rule (codified in Batch B).

-- 1. activated_by column ----------------------------------------------------

alter table public.t20_rubric_versions
  add column activated_by uuid references public.profiles(id) on delete set null;

comment on column public.t20_rubric_versions.activated_by is
  'Profile that activated this version. Set by activate_rubric_version RPC; null on '
  'pre-RPC rows + on rows that have never been activated. ON DELETE SET NULL so '
  'history survives super_admin removal — matches the created_by pattern.';

-- 2. activate_rubric_version RPC --------------------------------------------

create or replace function public.activate_rubric_version(p_version_id uuid)
returns public.t20_rubric_versions
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role text := public.current_role();
  v_target public.t20_rubric_versions;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if v_role is distinct from 'super_admin' then
    raise exception using errcode = '42501', message = 'super_admin_only';
  end if;

  -- Serialise concurrent activators. The partial unique index
  -- t20_rubric_versions_one_active would catch the race after the
  -- fact (one activator's UPDATE trips a unique violation), but
  -- the advisory lock prevents the violation entirely and gives
  -- a clean serialisation point. Lock is per-transaction.
  perform pg_advisory_xact_lock(hashtext('t20_rubric_versions.activate'));

  -- Lock the target row + read its current state.
  select *
    into v_target
    from public.t20_rubric_versions
   where id = p_version_id
     for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'not_found';
  end if;
  if v_target.is_active then
    raise exception using errcode = '23514', message = 'already_active';
  end if;

  -- Deactivate the current active row (if any) — must come before
  -- the target activation to satisfy the partial unique index.
  update public.t20_rubric_versions
     set is_active = false
   where is_active = true;

  -- Activate the target.
  update public.t20_rubric_versions
     set is_active = true,
         activated_at = now(),
         activated_by = v_actor_id
   where id = p_version_id
   returning * into v_target;

  -- Audit-log entry. table_name + row_id keyed for the
  -- audit_log_visible_to_admin helper; payload carries the
  -- version label for forensic readability.
  insert into public.audit_log (
    table_name, row_id, action, performed_by, payload
  ) values (
    't20_rubric_versions',
    p_version_id,
    'activate_rubric_version',
    v_actor_id,
    jsonb_build_object('version', v_target.version)
  );

  return v_target;
end;
$$;

revoke all on function public.activate_rubric_version(uuid) from public;
grant execute on function public.activate_rubric_version(uuid) to authenticated;

comment on function public.activate_rubric_version(uuid) is
  'Atomic rubric-version activation. Verifies caller is super_admin '
  '(via JWT role claim), serialises concurrent activators via '
  'pg_advisory_xact_lock, deactivates the current active version, '
  'activates the target, writes an audit_log entry. Raises 42501 on '
  'auth/role failures, P0002 if the target version_id is missing, '
  '23514 if the target is already active. Returns the activated row.';
