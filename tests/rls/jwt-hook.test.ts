import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, createTestUser, seedClub, signIn } from "./helpers";

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("JWT hook — custom_access_token_hook", () => {
  let clubA: string;

  beforeAll(async () => {
    clubA = await seedClub("JWT Hook Club A");
    clubs.push(clubA);
  });

  it("attaches app_metadata.role='player' for a player", async () => {
    const u = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(u.id);
    const s = await signIn(u);
    expect(s.jwt.app_metadata.role).toBe("player");
    expect(s.jwt.app_metadata.club_ids).toEqual([clubA]);
  });

  it("returns UNION of memberships + admin assignments for a club_admin", async () => {
    const clubB = await seedClub("JWT Hook Club B");
    clubs.push(clubB);
    const u = await createTestUser({
      role: "club_admin",
      clubIds: [clubA, clubB],
    });
    users.push(u.id);
    const s = await signIn(u);
    expect(s.jwt.app_metadata.role).toBe("club_admin");
    expect(s.jwt.app_metadata.club_ids).toEqual(
      expect.arrayContaining([clubA, clubB]),
    );
  });

  it("attaches empty club_ids for a super_admin with no memberships", async () => {
    const u = await createTestUser({ role: "super_admin" });
    users.push(u.id);
    const s = await signIn(u);
    expect(s.jwt.app_metadata.role).toBe("super_admin");
    expect(s.jwt.app_metadata.club_ids).toEqual([]);
  });
});
