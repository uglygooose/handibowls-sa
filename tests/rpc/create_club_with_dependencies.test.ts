import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/types/database.types";

import {
  admin,
  cleanup,
  createTestUser,
  signIn,
  type TestSession,
  type TestUser,
} from "../rls/helpers";

type ThemePreset = Database["public"]["Enums"]["club_theme_preset"];

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

async function firstDistrictId(): Promise<string> {
  const { data, error } = await admin()
    .from("districts")
    .select("id")
    .limit(1)
    .single();
  if (error || !data) throw new Error(`no districts seeded: ${error?.message}`);
  return data.id;
}

type RpcInput = {
  p_name: string;
  p_short_name: string;
  p_slug: string;
  p_district_id: string;
  p_city: string;
  p_contact_email: string;
  p_contact_phone: string;
  p_logo_path: string;
  p_theme_preset: ThemePreset;
  p_admin_email: string;
  p_greens: Array<{ name: string; rink_count: number }>;
  p_player_emails: string[];
};

function basePayload(overrides: Partial<RpcInput> & { p_district_id: string }): RpcInput {
  const uid = randomUUID();
  const defaults: RpcInput = {
    p_name: `Test Club ${uid.slice(0, 8)}`,
    p_short_name: "TC",
    p_slug: `test-${uid}`,
    p_district_id: overrides.p_district_id,
    p_city: "Testville",
    p_contact_email: "",
    p_contact_phone: "",
    p_logo_path: "",
    p_theme_preset: "atomic-red",
    p_admin_email: `admin-${uid}@test.handibowls.local`,
    p_greens: [{ name: "Main", rink_count: 6 }],
    p_player_emails: [],
  };
  return { ...defaults, ...overrides };
}

describe("RPC · create_club_with_dependencies", () => {
  let districtId: string;
  let superAdmin: TestUser;
  let superSession: TestSession;

  beforeAll(async () => {
    districtId = await firstDistrictId();
    superAdmin = await createTestUser({ role: "super_admin" });
    users.push(superAdmin.id);
    superSession = await signIn(superAdmin);
  });

  it("creates the club, greens, rinks, admin invite, and player invites", async () => {
    const payload = basePayload({
      p_district_id: districtId,
      p_greens: [
        { name: "Main", rink_count: 6 },
        { name: "Back", rink_count: 4 },
      ],
      p_player_emails: [
        `p1-${randomUUID()}@test.handibowls.local`,
        `p2-${randomUUID()}@test.handibowls.local`,
      ],
    });

    const { data: clubId, error } = await superSession.client.rpc(
      "create_club_with_dependencies",
      payload,
    );
    expect(error).toBeNull();
    expect(typeof clubId).toBe("string");
    clubs.push(clubId as string);

    const a = admin();

    const { data: clubRow } = await a
      .from("clubs")
      .select("id, name, slug, theme_preset")
      .eq("id", clubId!)
      .single();
    expect(clubRow?.slug).toBe(payload.p_slug);
    expect(clubRow?.theme_preset).toBe("atomic-red");

    const { data: greenRows } = await a
      .from("greens")
      .select("id, name, rink_count")
      .eq("club_id", clubId!);
    expect(greenRows).toHaveLength(2);
    const byName = Object.fromEntries((greenRows ?? []).map((g) => [g.name, g]));
    expect(byName.Main?.rink_count).toBe(6);
    expect(byName.Back?.rink_count).toBe(4);

    const greenIds = (greenRows ?? []).map((g) => g.id);
    const { data: rinkRows } = await a
      .from("rinks")
      .select("green_id, number")
      .in("green_id", greenIds);
    expect(rinkRows).toHaveLength(10); // 6 + 4

    const { data: inviteRows } = await a
      .from("invites")
      .select("email, role")
      .eq("club_id", clubId!);
    const byRole = (inviteRows ?? []).reduce<Record<string, number>>(
      (acc, r) => ((acc[r.role] = (acc[r.role] ?? 0) + 1), acc),
      {},
    );
    expect(byRole.club_admin).toBe(1);
    expect(byRole.player).toBe(2);
  });

  it("rejects non-super-admin callers", async () => {
    const player = await createTestUser({ role: "player" });
    users.push(player.id);
    const session = await signIn(player);

    const { error } = await session.client.rpc(
      "create_club_with_dependencies",
      basePayload({ p_district_id: districtId }),
    );
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toContain("super_admin");
  });

  it("rolls back the entire transaction when a green is invalid", async () => {
    const uid = randomUUID();
    const slug = `test-rollback-${uid}`;
    const adminEmail = `rollback-${uid}@test.handibowls.local`;

    const { error } = await superSession.client.rpc(
      "create_club_with_dependencies",
      basePayload({
        p_district_id: districtId,
        p_slug: slug,
        p_admin_email: adminEmail,
        p_greens: [
          { name: "OK", rink_count: 4 },
          { name: "Bad", rink_count: 99 }, // invalid → raise
        ],
      }),
    );
    expect(error).not.toBeNull();

    const a = admin();
    const { data: clubRows } = await a
      .from("clubs")
      .select("id")
      .eq("slug", slug);
    expect(clubRows).toEqual([]);

    const { data: inviteRows } = await a
      .from("invites")
      .select("id")
      .eq("email", adminEmail);
    expect(inviteRows).toEqual([]);
  });

  it("rejects an invalid theme preset", async () => {
    const { error } = await superSession.client.rpc(
      "create_club_with_dependencies",
      basePayload({
        p_district_id: districtId,
        p_theme_preset: "not-a-real-preset" as ThemePreset,
      }),
    );
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toMatch(/club_theme_preset|invalid input/);
  });

  it("rejects a green with rink_count > 12", async () => {
    const { error } = await superSession.client.rpc(
      "create_club_with_dependencies",
      basePayload({
        p_district_id: districtId,
        p_greens: [{ name: "Too big", rink_count: 13 }],
      }),
    );
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toContain("rink_count");
  });
});
