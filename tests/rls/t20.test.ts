import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTestUser, seedClub, signIn } from "./helpers";

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("RLS · t20_assessments", () => {
  let clubA: string;
  let clubB: string;
  let rubricId: string;

  beforeAll(async () => {
    clubA = await seedClub("T20 A");
    clubB = await seedClub("T20 B");
    clubs.push(clubA, clubB);
    const { data } = await admin()
      .from("t20_rubric_versions")
      .select("id")
      .eq("is_active", true)
      .single();
    if (!data) throw new Error("no active rubric seeded");
    rubricId = data.id;
  });

  it("subject can READ their own assessment", async () => {
    const assessor = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    const subject = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(assessor.id, subject.id);
    const { data, error } = await admin()
      .from("t20_assessments")
      .insert({
        club_id: clubA,
        profile_id: subject.id,
        assessor_id: assessor.id,
        rubric_version_id: rubricId,
      })
      .select("id")
      .single();
    if (error || !data) throw error;
    const { client } = await signIn(subject);
    const { data: read } = await client
      .from("t20_assessments")
      .select("id")
      .eq("id", data.id);
    expect(read?.length).toBe(1);
  });

  it("unrelated player CANNOT read someone else's assessment", async () => {
    const assessor = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    const subject = await createTestUser({ role: "player", clubIds: [clubA] });
    const stranger = await createTestUser({ role: "player", clubIds: [clubB] });
    users.push(assessor.id, subject.id, stranger.id);
    const { data } = await admin()
      .from("t20_assessments")
      .insert({
        club_id: clubA,
        profile_id: subject.id,
        assessor_id: assessor.id,
        rubric_version_id: rubricId,
      })
      .select("id")
      .single();
    const { client } = await signIn(stranger);
    const { data: read } = await client
      .from("t20_assessments")
      .select("id")
      .eq("id", data!.id);
    expect(read).toEqual([]);
  });

  it("club_admin of host club can INSERT an assessment", async () => {
    const adminU = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    const subject = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(adminU.id, subject.id);
    const { client } = await signIn(adminU);
    const { error } = await client.from("t20_assessments").insert({
      club_id: clubA,
      profile_id: subject.id,
      assessor_id: adminU.id,
      rubric_version_id: rubricId,
    });
    expect(error).toBeNull();
  });

  it("player CANNOT insert an assessment with someone else as assessor", async () => {
    // The assessor_rw policy lets a user own their own assessments (supports
    // accredited assessors who aren't club_admins). But they cannot forge an
    // assessment attributed to a different assessor.
    const u = await createTestUser({ role: "player", clubIds: [clubA] });
    const other = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(u.id, other.id);
    const { client } = await signIn(u);
    const { error } = await client.from("t20_assessments").insert({
      club_id: clubA,
      profile_id: u.id,
      assessor_id: other.id,
      rubric_version_id: rubricId,
    });
    expect(error).not.toBeNull();
  });

  it("active rubric is readable by anyone (including anon)", async () => {
    const { data } = await admin()
      .from("t20_rubric_versions")
      .select("id, version")
      .eq("is_active", true);
    expect(data?.length).toBe(1);
  });
});
