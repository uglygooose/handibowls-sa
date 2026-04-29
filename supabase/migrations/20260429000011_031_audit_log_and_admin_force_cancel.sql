-- Phase 9 / Migration 031 — generic audit_log table + admin RPC for
-- force-cancelling a booking with audit-trail.
--
-- Why a generic table over a per-table audit (e.g. bookings_audit)
--
--   The audit shape doesn't vary by the audited entity: every action
--   has (table_name, row_id, action, reason, payload, performed_by,
--   performed_at). Splitting per-entity would force a new table for
--   every audited surface — wasteful when the same shape covers
--   everything. Future audited tables (tournaments admin overrides,
--   t20_assessments grade overrides, matches verifyMatch overrides)
--   plug in by calling the same INSERT shape from their own RPCs;
--   the read policy extends via the SECURITY DEFINER visibility
--   helper, not by adding new policies per table.
--
--   The design source's existing tournament `AuditTab` empty-state
--   (`handibowls/project/page-detail-tabs.jsx:418-448`) explicitly
--   references an `audit_log` table with the same shape — this is
--   the pre-figured destination, not a Phase-9-specific invention.
--
-- Read RLS — club-scoped via SECURITY DEFINER helper
--
--   `audit_log_visible_to_admin(p_row_id uuid)` resolves the audited
--   row's club_id (per table_name) and checks against
--   `current_club_ids()`. Defined SECURITY DEFINER so the join
--   bypasses RLS on the audited table — audit visibility is a
--   different policy from row visibility (an admin can audit a
--   booking they couldn't otherwise read). Initially handles
--   table_name='bookings'; extends with `elsif table_name = 'X'`
--   branches as Phase 10 / 11 / 12 add their own audited paths.
--
--   INSERT is RPC-only — no INSERT policy. All audit rows land via
--   SECURITY DEFINER actions like admin_force_cancel_booking below.
--   This is by design: the application layer cannot conjure an audit
--   row that doesn't correspond to an actual mutation.
--
-- admin_force_cancel_booking RPC
--
--   Mirrors migration 030's `cancel_own_booking` patterns:
--     • Captures auth.uid() at function entry (per migration 019)
--     • Typed errcodes + `<rpc_name>: <slug>` message prefixes for
--       action-layer routing
--     • SECURITY DEFINER bypasses RLS for the UPDATE; in-function
--       gates ARE the authorization
--     • revoke all from public; grant execute to authenticated
--
--   Differences from cancel_own_booking:
--     • Caller must be club_admin owning the booking's club, OR
--       super_admin (no team-membership check — admins by definition
--       don't play the booking)
--     • No 2h gate — admins can cancel any future booking
--     • Reason text required (non-empty, ≤500 chars enforced
--       partially here as length CHECK; full Zod validation at the
--       action layer)
--     • Writes an audit_log row alongside the cancel — atomic in the
--       same function transaction, so cancel-without-audit is
--       impossible
--
-- Out of scope (Phase 11 / 12.5 deferrals confirmed)
--
--   • Reminders 2h before start — Phase 11 Resend pipeline.
--   • Fair-Rink hints algorithm — Phase 12.5 polish.
--   • admin_force_book RPC — confirmed skip; admins use existing
--     bookings_club_admin_rw INSERT permission. Override workflow is
--     force-cancel → re-book = two audit rows, clean trail. A
--     single-RPC override that bypassed GIST would be a footgun.

-- 1. audit_log table -----------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid not null,
  action text not null,
  reason text,
  payload jsonb,
  performed_by uuid references public.profiles(id) on delete set null,
  performed_at timestamptz not null default now(),
  constraint audit_log_table_name_nonempty check (length(btrim(table_name)) > 0),
  constraint audit_log_action_nonempty check (length(btrim(action)) > 0),
  constraint audit_log_reason_length check (reason is null or length(reason) <= 500)
);

create index audit_log_table_row_idx on public.audit_log (table_name, row_id);
create index audit_log_performed_at_idx on public.audit_log (performed_at desc);
create index audit_log_performed_by_idx on public.audit_log (performed_by);

alter table public.audit_log enable row level security;

-- 2. visibility helper ---------------------------------------------------
-- Resolves the audited row's club_id per table and checks against the
-- caller's club_ids JWT claim. SECURITY DEFINER so the helper can read
-- the audited table even when the caller's RLS would deny the row.
-- Audit visibility is a parallel policy axis: an admin can audit a
-- booking even if (hypothetically) the booking was cross-club.
create or replace function public.audit_log_visible_to_admin(
  p_table_name text,
  p_row_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_club_id uuid;
begin
  if p_table_name = 'bookings' then
    select club_id into v_club_id
      from public.bookings
     where id = p_row_id;
    if v_club_id is null then
      return false;
    end if;
    return v_club_id = ANY (public.current_club_ids());
  end if;

  -- Future audited tables plug in here. Default-deny for unknown
  -- table names so a hostile insert with a fabricated table_name
  -- doesn't expose audit rows for entities the helper can't scope.
  return false;
end;
$$;

revoke all on function public.audit_log_visible_to_admin(text, uuid) from public;
grant execute on function public.audit_log_visible_to_admin(text, uuid) to authenticated;

-- 3. RLS policies --------------------------------------------------------
-- super_admin: full read + write (write is rare; mostly future tooling)
create policy audit_log_super_admin_all on public.audit_log
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

-- club_admin: SELECT-only, scoped via the visibility helper
create policy audit_log_club_admin_read on public.audit_log
  for select to authenticated
  using (
    public.current_role() = 'club_admin'
    and public.audit_log_visible_to_admin(table_name, row_id)
  );

-- No INSERT/UPDATE/DELETE policy for club_admin or player. INSERTs come
-- exclusively from SECURITY DEFINER functions like
-- admin_force_cancel_booking which write the row themselves; bypassing
-- RLS for that single write is the design.

-- 4. admin_force_cancel_booking RPC --------------------------------------
create or replace function public.admin_force_cancel_booking(
  p_booking_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_role user_role;
  v_booking record;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_user is null then
    raise exception 'admin_force_cancel_booking: not_authenticated'
      using errcode = '42501';
  end if;

  v_role := public.current_role();
  if v_role not in ('club_admin', 'super_admin') then
    raise exception 'admin_force_cancel_booking: insufficient_role'
      using errcode = '42501';
  end if;

  if length(v_reason) = 0 then
    raise exception 'admin_force_cancel_booking: reason_required'
      using errcode = '22004';
  end if;

  if length(v_reason) > 500 then
    raise exception 'admin_force_cancel_booking: reason_too_long'
      using errcode = '22001';
  end if;

  select id, club_id, status, starts_at
    into v_booking
    from public.bookings
   where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'admin_force_cancel_booking: not_found'
      using errcode = 'P0002';
  end if;

  -- club_admin must own the booking's club. super_admin bypasses.
  if v_role = 'club_admin'
     and not (v_booking.club_id = ANY (public.current_club_ids())) then
    raise exception 'admin_force_cancel_booking: wrong_club'
      using errcode = '42501';
  end if;

  if v_booking.status <> 'booked' then
    raise exception 'admin_force_cancel_booking: wrong_state'
      using errcode = '22023';
  end if;

  update public.bookings
     set status = 'cancelled'
   where id = p_booking_id;

  insert into public.audit_log (
    table_name, row_id, action, reason, performed_by
  )
  values (
    'bookings', p_booking_id, 'force_cancel_booking', v_reason, v_user
  );
end;
$$;

revoke all on function public.admin_force_cancel_booking(uuid, text) from public;
grant execute on function public.admin_force_cancel_booking(uuid, text) to authenticated;
