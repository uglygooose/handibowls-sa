import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { admin, cleanup, createTestUser, seedClub, signIn } from "./helpers";

// Phase 12 / 12-2 — tournament_greens RLS.
//
// Mirrors the tournaments RLS matrix:
//   super_admin       → all
//   club_admin (host) → rw
//   member of host    → read
//   admin of OTHER    → blocked

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

async function seedGreen(clubId: string): Promise<string> {
  const a = admin();
  const { data, error } = await a
    .from("greens")
    .insert({
      club_id: clubId,
      name: `green-${randomUUID().slice(0, 8)}`,
      rink_count: 6,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`seedGreen: ${error?.message}`);
  return data.id;
}

describe("RLS · tournament_greens", () => {
  let clubA: string;
  let clubB: string;
  let tourA: string;
  let greenA1: string;
  let greenA2: string;

  beforeAll(async () => {
    clubA = await seedClub("TG A");
    clubB = await seedClub("TG B");
    clubs.push(clubA, clubB);

    greenA1 = await seedGreen(clubA);
    greenA2 = await seedGreen(clubA);

    const { data, error } = await admin()
      .from("tournaments")
      .insert({
        host_club_id: clubA,
        name: "TG Seed Classic",
        format: "singles",
        structure: "knockout",
        status: "open",
      })
      .select("id")
      .single();
    if (error || !data) throw error;
    tourA = data.id;
  });

  it("host club_admin can insert tournament_greens links", async () => {
    const adminA = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    users.push(adminA.id);
    const { client } = await signIn(adminA);
    const { error } = await client
      .from("tournament_greens")
      .insert([{ tournament_id: tourA, green_id: greenA1 }]);
    expect(error).toBeNull();
  });

  it("admin of OTHER club cannot insert tournament_greens links for this tournament", async () => {
    const adminB = await createTestUser({ role: "club_admin", clubIds: [clubB] });
    users.push(adminB.id);
    const { client } = await signIn(adminB);
    const { error } = await client
      .from("tournament_greens")
      .insert([{ tournament_id: tourA, green_id: greenA2 }]);
    expect(error).not.toBeNull();
    // RLS denial surfaces as a row-level-security error code.
  });

  it("host_club_admin can delete tournament_greens links", async () => {
    const adminA = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    users.push(adminA.id);
    const { client } = await signIn(adminA);
    // Seed a fresh link to delete
    await admin()
      .from("tournament_greens")
      .insert([{ tournament_id: tourA, green_id: greenA2 }])
      .throwOnError();
    const { error } = await client
      .from("tournament_greens")
      .delete()
      .eq("tournament_id", tourA)
      .eq("green_id", greenA2);
    expect(error).toBeNull();
  });

  it("member of host club can SELECT tournament_greens links", async () => {
    const member = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(member.id);
    const { client } = await signIn(member);
    const { data, error } = await client
      .from("tournament_greens")
      .select("tournament_id, green_id")
      .eq("tournament_id", tourA);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it("non-member of host club cannot SELECT tournament_greens for that tournament", async () => {
    const stranger = await createTestUser({ role: "player", clubIds: [clubB] });
    users.push(stranger.id);
    const { client } = await signIn(stranger);
    const { data } = await client
      .from("tournament_greens")
      .select("tournament_id, green_id")
      .eq("tournament_id", tourA);
    // RLS filters out the rows; no error, but empty result.
    expect(data?.length ?? 0).toBe(0);
  });
});
