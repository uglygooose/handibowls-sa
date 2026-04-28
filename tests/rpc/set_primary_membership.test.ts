import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  admin,
  cleanup,
  createTestUser,
  seedClub,
  signIn,
  type TestSession,
  type TestUser,
} from "../rls/helpers";

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("RPC · set_primary_membership", () => {
  let clubA: string;
  let clubB: string;
  let player: TestUser;
  let session: TestSession;
  let membershipA: string;
  let membershipB: string;

  beforeAll(async () => {
    clubA = await seedClub("set-primary-membership clubA");
    clubB = await seedClub("set-primary-membership clubB");
    clubs.push(clubA, clubB);

    player = await createTestUser({ role: "player", clubIds: [clubA, clubB] });
    users.push(player.id);

    // createTestUser inserts memberships with is_primary=false. Promote one
    // to is_primary=true so we have a starting state of "A is primary".
    const a = admin();
    await a
      .from("club_memberships")
      .update({ is_primary: true })
      .eq("profile_id", player.id)
      .eq("club_id", clubA);

    const { data: rows } = await a
      .from("club_memberships")
      .select("id, club_id")
      .eq("profile_id", player.id);
    membershipA = rows!.find((r) => r.club_id === clubA)!.id;
    membershipB = rows!.find((r) => r.club_id === clubB)!.id;

    session = await signIn(player);
  });

  it("flips the primary atomically — old primary clears, new primary sets, and the partial unique index never trips", async () => {
    const { error } = await session.client.rpc("set_primary_membership", {
      p_membership_id: membershipB,
    });
    expect(error).toBeNull();

    const a = admin();
    const { data: rows } = await a
      .from("club_memberships")
      .select("id, is_primary")
      .eq("profile_id", player.id);
    const byId = Object.fromEntries((rows ?? []).map((r) => [r.id, r.is_primary]));
    expect(byId[membershipB]).toBe(true);
    expect(byId[membershipA]).toBe(false);

    // Cycle back so subsequent tests have a deterministic starting state.
    await session.client.rpc("set_primary_membership", {
      p_membership_id: membershipA,
    });
  });

  it("rejects a membership the caller doesn't own", async () => {
    // Create a second player with their own membership; signed-in player
    // tries to flip THAT row.
    const otherClub = await seedClub("set-primary-membership otherClub");
    clubs.push(otherClub);
    const otherPlayer = await createTestUser({
      role: "player",
      clubIds: [otherClub],
    });
    users.push(otherPlayer.id);

    const a = admin();
    const { data: otherRows } = await a
      .from("club_memberships")
      .select("id")
      .eq("profile_id", otherPlayer.id);
    const otherMembershipId = otherRows![0].id;

    const { error } = await session.client.rpc("set_primary_membership", {
      p_membership_id: otherMembershipId,
    });
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toContain("not your membership");
  });

  it("rejects a membership that exists for the caller but is inactive", async () => {
    // Mark clubB membership as inactive, then try to flip to it.
    const a = admin();
    await a
      .from("club_memberships")
      .update({ status: "inactive" })
      .eq("id", membershipB);

    const { error } = await session.client.rpc("set_primary_membership", {
      p_membership_id: membershipB,
    });
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toContain("not your membership");

    // Restore so the test club state stays usable.
    await a
      .from("club_memberships")
      .update({ status: "active" })
      .eq("id", membershipB);
  });

  it("rejects an unauthenticated caller (anon client)", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await anon.rpc("set_primary_membership", {
      p_membership_id: membershipA,
    });
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toContain("not authenticated");
  });
});
