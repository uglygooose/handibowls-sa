import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTestUser, seedClub, signIn } from "./helpers";

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("RLS · messages + notifications", () => {
  let clubA: string;
  let clubB: string;

  beforeAll(async () => {
    clubA = await seedClub("Msg A");
    clubB = await seedClub("Msg B");
    clubs.push(clubA, clubB);
  });

  it("club_admin can INSERT a message in their club", async () => {
    const adminU = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    users.push(adminU.id);
    const { client } = await signIn(adminU);
    const { error } = await client.from("messages").insert({
      club_id: clubA,
      sender_id: adminU.id,
      subject: "Hi",
      body_md: "Body",
    });
    expect(error).toBeNull();
  });

  it("club_admin of another club CANNOT create a message in foreign club", async () => {
    const u = await createTestUser({ role: "club_admin", clubIds: [clubB] });
    users.push(u.id);
    const { client } = await signIn(u);
    const { error } = await client.from("messages").insert({
      club_id: clubA,
      sender_id: u.id,
      subject: "Cross",
      body_md: "Body",
    });
    expect(error).not.toBeNull();
  });

  it("recipient can READ a message addressed to them", async () => {
    const adminU = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    const recipient = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(adminU.id, recipient.id);
    const a = admin();
    const { data: msg } = await a
      .from("messages")
      .insert({
        club_id: clubA,
        sender_id: adminU.id,
        subject: "Direct",
        body_md: "For you",
      })
      .select("id")
      .single();
    await a.from("message_recipients").insert({
      message_id: msg!.id,
      profile_id: recipient.id,
    });
    const { client } = await signIn(recipient);
    const { data } = await client
      .from("messages")
      .select("id")
      .eq("id", msg!.id);
    expect(data?.length).toBe(1);
  });

  it("non-recipient player CANNOT read a message", async () => {
    const adminU = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    const outsider = await createTestUser({ role: "player", clubIds: [clubB] });
    users.push(adminU.id, outsider.id);
    const { data: msg } = await admin()
      .from("messages")
      .insert({
        club_id: clubA,
        sender_id: adminU.id,
        subject: "Private",
        body_md: "Body",
      })
      .select("id")
      .single();
    const { client } = await signIn(outsider);
    const { data } = await client
      .from("messages")
      .select("id")
      .eq("id", msg!.id);
    expect(data).toEqual([]);
  });

  it("user can READ their own notifications only", async () => {
    const u1 = await createTestUser({ role: "player", clubIds: [clubA] });
    const u2 = await createTestUser({ role: "player", clubIds: [clubA] });
    users.push(u1.id, u2.id);
    const a = admin();
    await a.from("notifications").insert([
      { profile_id: u1.id, kind: "test", title: "u1 only" },
      { profile_id: u2.id, kind: "test", title: "u2 only" },
    ]);
    const { client } = await signIn(u1);
    const { data } = await client.from("notifications").select("title");
    const titles = (data ?? []).map((n) => n.title);
    expect(titles).toContain("u1 only");
    expect(titles).not.toContain("u2 only");
  });
});
