import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { admin, cleanup, createTestUser, seedClub, signIn } from "./helpers";

// Phase 9-3 — audit_log RLS coverage.
//
// Migration 031 declares two read policies:
//
//   • audit_log_super_admin_all  — full access for super_admin.
//   • audit_log_club_admin_read  — SELECT for club_admin gated by
//                                  audit_log_visible_to_admin(table_name, row_id).
//
// The visibility helper resolves the audited row's club_id (currently
// only handles `table_name='bookings'`; future tables plug in via
// elsif branches). It runs SECURITY DEFINER so the join can read
// the audited table even when the caller's RLS would deny the row —
// audit visibility is a parallel policy axis from row visibility.
//
// We seed audit rows directly (bypassing the RPC) to keep the tests
// focused on the read policy. The RPC's INSERT path is exercised in
// the bookings RLS suite via the 9-2 admin_force_cancel_booking
// cases.

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("RLS · audit_log", () => {
  let clubA: string;
  let clubB: string;
  let bookingAtClubA: string;
  let bookingAtClubB: string;
  let auditRowAtClubA: string;
  let auditRowAtClubB: string;

  beforeAll(async () => {
    clubA = await seedClub("Audit A");
    clubB = await seedClub("Audit B");
    clubs.push(clubA, clubB);

    const a = admin();

    // Seed minimal greens + rinks for both clubs.
    const { data: greenA } = await a
      .from("greens")
      .insert({ club_id: clubA, name: "GA" })
      .select("id")
      .single();
    const { data: rinkA } = await a
      .from("rinks")
      .insert({ green_id: greenA!.id, number: 1 })
      .select("id")
      .single();
    const { data: greenB } = await a
      .from("greens")
      .insert({ club_id: clubB, name: "GB" })
      .select("id")
      .single();
    const { data: rinkB } = await a
      .from("rinks")
      .insert({ green_id: greenB!.id, number: 1 })
      .select("id")
      .single();

    // One booking per club to anchor the audit_log rows.
    const startA = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const endA = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const { data: bA } = await a
      .from("bookings")
      .insert({
        rink_id: rinkA!.id,
        club_id: clubA,
        starts_at: startA,
        ends_at: endA,
      })
      .select("id")
      .single();
    bookingAtClubA = bA!.id;

    const startB = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const endB = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();
    const { data: bB } = await a
      .from("bookings")
      .insert({
        rink_id: rinkB!.id,
        club_id: clubB,
        starts_at: startB,
        ends_at: endB,
      })
      .select("id")
      .single();
    bookingAtClubB = bB!.id;

    // Seed audit rows directly. Service-role bypasses RLS — this
    // mimics what the SECURITY DEFINER RPC would have written.
    const { data: aLog } = await a
      .from("audit_log")
      .insert({
        table_name: "bookings",
        row_id: bookingAtClubA,
        action: "force_cancel_booking",
        reason: "test seed clubA",
      })
      .select("id")
      .single();
    auditRowAtClubA = aLog!.id;

    const { data: bLog } = await a
      .from("audit_log")
      .insert({
        table_name: "bookings",
        row_id: bookingAtClubB,
        action: "force_cancel_booking",
        reason: "test seed clubB",
      })
      .select("id")
      .single();
    auditRowAtClubB = bLog!.id;
  });

  it("club_admin CAN read audit rows for bookings at their own club", async () => {
    const adminA = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminA.id);
    const { client } = await signIn(adminA);
    const { data, error } = await client
      .from("audit_log")
      .select("id, row_id, reason")
      .eq("id", auditRowAtClubA)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(auditRowAtClubA);
    expect(data?.row_id).toBe(bookingAtClubA);
  });

  it("club_admin CANNOT read audit rows for bookings at OTHER clubs", async () => {
    const adminA = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminA.id);
    const { client } = await signIn(adminA);
    const { data, error } = await client
      .from("audit_log")
      .select("id")
      .eq("id", auditRowAtClubB)
      .maybeSingle();
    // RLS-filtered: no error, just no row.
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("club_admin filtered SELECT returns ONLY their club's rows (no leakage)", async () => {
    const adminA = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminA.id);
    const { client } = await signIn(adminA);
    const { data, error } = await client
      .from("audit_log")
      .select("id, row_id")
      .in("id", [auditRowAtClubA, auditRowAtClubB]);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].id).toBe(auditRowAtClubA);
  });

  it("super_admin CAN read audit rows from ANY club", async () => {
    const sup = await createTestUser({ role: "super_admin", clubIds: [] });
    users.push(sup.id);
    const { client } = await signIn(sup);
    const { data, error } = await client
      .from("audit_log")
      .select("id")
      .in("id", [auditRowAtClubA, auditRowAtClubB])
      .order("id");
    expect(error).toBeNull();
    expect(data?.length).toBe(2);
  });

  it("player CANNOT read audit rows even at clubs they belong to", async () => {
    const player = await createTestUser({
      role: "player",
      clubIds: [clubA],
    });
    users.push(player.id);
    const { client } = await signIn(player);
    const { data, error } = await client
      .from("audit_log")
      .select("id")
      .eq("id", auditRowAtClubA)
      .maybeSingle();
    // Both `audit_log_super_admin_all` and `audit_log_club_admin_read`
    // exclude players; no policy grants — no rows.
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("audit_log_visible_to_admin returns false for unknown table_names (default-deny)", async () => {
    // Seed an audit row for an invented table and confirm even the
    // owning club's admin can't read it. Belt-and-braces against
    // hostile inserts that would fabricate row_ids the helper can't
    // scope.
    const a = admin();
    const { data: rogueRow } = await a
      .from("audit_log")
      .insert({
        table_name: "tournaments", // not yet handled by the helper
        row_id: bookingAtClubA, // reuse a real uuid
        action: "force_state_change",
        reason: "rogue table_name test",
      })
      .select("id")
      .single();
    const adminA = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminA.id);
    const { client } = await signIn(adminA);
    const { data, error } = await client
      .from("audit_log")
      .select("id")
      .eq("id", rogueRow!.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("club_admin CANNOT INSERT audit rows directly (RPC-only)", async () => {
    const adminA = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminA.id);
    const { client } = await signIn(adminA);
    const { error } = await client.from("audit_log").insert({
      table_name: "bookings",
      row_id: bookingAtClubA,
      action: "fabricated_event",
      reason: "should be denied",
    });
    expect(error).not.toBeNull();
  });

  it("club_admin CANNOT UPDATE audit rows (no policy granting it)", async () => {
    const adminA = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminA.id);
    const { client } = await signIn(adminA);
    const { error, data } = await client
      .from("audit_log")
      .update({ reason: "tampered" })
      .eq("id", auditRowAtClubA)
      .select();
    // Either RLS denies (error.code 42501) or returns 0 rows updated.
    // PostgREST UPDATE with no policy granting returns no rows.
    if (error) {
      expect(error.code).toBeDefined();
    } else {
      expect(data).toEqual([]);
    }
  });
});
