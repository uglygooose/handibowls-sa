-- Phase 8e / Migration 030 — public.cancel_own_booking(uuid) RPC
--
-- Phase 9 (player carve-out) step 3: "Cancel up to 2h before start."
-- The existing RLS policies on public.bookings (010) cover read +
-- self-insert + admin-RW, but there is no player-side UPDATE/DELETE
-- policy — so a player can create a booking and then can't change
-- its status. This migration closes that gap with a single
-- SECURITY DEFINER RPC rather than an RLS UPDATE policy + trigger
-- pair.
--
-- Why RPC over RLS UPDATE policy
--
--   The cancel contract has THREE business rules a column-level RLS
--   policy can express only awkwardly:
--
--     (1) booked_by = auth.uid() — caller must own the row
--     (2) status = 'booked' — can't cancel an already-cancelled row
--     (3) starts_at > now() + interval '2 hours' — 2h gate
--
--   plus a column-immutability rule (only `status` may flip; other
--   columns stay frozen). Encoding (1)+(2) in `using` + `with check`
--   is fine; (3) needs a `with check` predicate that depends on
--   server time which is brittle, and the column-immutability rule
--   needs a BEFORE UPDATE trigger on top. Two layers + a 2h gate
--   spread across them is harder to audit than a single function
--   with all four rules co-located. Same reasoning that drove
--   migrations 026/028/029 to lean on triggers + state-machines: one
--   point of enforcement, easy to read, easy to change.
--
--   The function is SECURITY DEFINER so it runs as the function owner
--   and bypasses RLS for the UPDATE — the in-function gates ARE the
--   authorization. `auth.uid()` resolves correctly inside SECURITY
--   DEFINER because it reads `current_setting('request.jwt.claim.sub')`,
--   which is request-context-bound and survives role-switching.
--   Captured into a local at function entry per migration 019's
--   pattern so the null-check is explicit and reused.
--
-- Error contract — typed errcodes + prefixed messages
--
--   The codebase has two precedents for surface-level errors raised
--   from PL/pgSQL:
--
--     • Triggers (023, 027, 028): plain `raise exception 'message'`
--       (defaults to SQLSTATE P0001). Tests pattern-match on message.
--     • RPCs (014, 016, 019): `raise exception 'message' using
--       errcode = '<sqlstate>'`. 014/016 use 22004 for required-field
--       validation; 019 uses 42501 for "Not authenticated."
--
--   This is an RPC, so it follows the RPC convention. Each error gets
--   a SQLSTATE chosen for semantic fit + a stable message prefix
--   (`cancel_own_booking: <slug>`) so the action layer can branch
--   cleanly:
--
--     • cancel_own_booking: not_found        — P0002 (no_data_found)
--     • cancel_own_booking: not_owner        — 42501 (insufficient_privilege)
--     • cancel_own_booking: wrong_state      — 22023 (invalid_parameter_value)
--     • cancel_own_booking: too_close_to_start — 22023 (invalid_parameter_value)
--
--   wrong_state and too_close_to_start share 22023 because they're
--   both "value precondition unmet" semantically; the action layer
--   distinguishes them by message prefix. SQLSTATE families are
--   coarse (auth vs validation vs data); the prefix is the
--   fine-grained discriminator.
--
-- Admin path is unaffected — admin_force_cancel_booking (Phase 9 admin
-- scope) is a separate future RPC with audit-trail semantics; this one
-- is player-only.

create or replace function public.cancel_own_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_booking record;
begin
  if v_user is null then
    raise exception 'cancel_own_booking: not_authenticated'
      using errcode = '42501';
  end if;

  select id, booked_by, status, starts_at
    into v_booking
    from public.bookings
   where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'cancel_own_booking: not_found'
      using errcode = 'P0002';
  end if;

  if v_booking.booked_by is distinct from v_user then
    raise exception 'cancel_own_booking: not_owner'
      using errcode = '42501';
  end if;

  if v_booking.status <> 'booked' then
    raise exception 'cancel_own_booking: wrong_state'
      using errcode = '22023';
  end if;

  if v_booking.starts_at <= now() + interval '2 hours' then
    raise exception 'cancel_own_booking: too_close_to_start'
      using errcode = '22023';
  end if;

  update public.bookings
     set status = 'cancelled'
   where id = p_booking_id;
end;
$$;

revoke all on function public.cancel_own_booking(uuid) from public;
grant execute on function public.cancel_own_booking(uuid) to authenticated;
