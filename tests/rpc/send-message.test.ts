import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanup, createTestUser, seedClub, signIn } from "../rls/helpers";

// Phase 11 / 11-2 — public.send_message(uuid) RPC integration tests.
//
// Hits the local Supabase stack. Covers:
//   1. all_members audience: 5 active members → 5 recipients + 5
//      notifications, status=sent.
//   2. tournament_entrants audience UNION: 1 singles entry + 1 team
//      with 3 members → 4 distinct recipients (no overlap),
//      status=sent. Withdrawn entries/teams excluded.
//   3. custom audience: array intersected with active club
//      members; non-members are silently filtered.
//   4. Idempotent re-call on status='sent' → no duplicate rows.
//   5. Validation errors (audience_kind=tournament_entrants but
//      audience_tournament_id NULL) → status='failed',
//      recipient_count=0.
//   6. Authorization: club_admin of OTHER club → 42501.
//   7. wrong_state guard: status='draft' → 22023.
//
// Non-goals: this file does NOT exercise the TypeScript wrapper
// at lib/messages/actions.ts directly (that has its own unit
// surface in 11-3 once compose UI lands). It exercises the RPC
// the wrapper calls.

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("RPC · public.send_message — audience resolution", () => {
  let clubA: string;
  let clubB: string;
  let adminA: { id: string };

  beforeAll(async () => {
    clubA = await seedClub("RPC SendMsg A");
    clubB = await seedClub("RPC SendMsg B");
    clubs.push(clubA, clubB);

    const a = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    users.push(a.id);
    adminA = { id: a.id };
  });

  it("all_members → one recipient + one notification per active member", async () => {
    const a = admin();

    // Seed 5 active members in clubA.
    const memberIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const u = await createTestUser({ role: "player", clubIds: [clubA] });
      users.push(u.id);
      memberIds.push(u.id);
    }

    const { data: msg } = await a
      .from("messages")
      .insert({
        club_id: clubA,
        sender_id: adminA.id,
        subject: "All-members broadcast",
        body_md: "Practice tomorrow at 17:00. Bring extra ends.",
        audience_kind: "all_members",
        status: "queued",
      })
      .select("id")
      .single();
    expect(msg).not.toBeNull();
    const messageId = msg!.id;

    // Sign in as adminA and call the RPC.
    const adminUser = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminUser.id);
    const { client } = await signIn(adminUser);
    const { data, error } = await client.rpc("send_message", {
      p_message_id: messageId,
    });
    expect(error).toBeNull();
    expect(data?.[0]?.status).toBe("sent");
    expect(data?.[0]?.recipient_count).toBe(5);

    const { count: recipCount } = await a
      .from("message_recipients")
      .select("*", { count: "exact", head: true })
      .eq("message_id", messageId);
    expect(recipCount).toBe(5);

    const { count: notifCount } = await a
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("related_id", messageId)
      .eq("related_kind", "message");
    expect(notifCount).toBe(5);

    // Status + sent_at + recipient_count on the row.
    const { data: row } = await a
      .from("messages")
      .select("status, recipient_count, sent_at")
      .eq("id", messageId)
      .single();
    expect(row?.status).toBe("sent");
    expect(row?.recipient_count).toBe(5);
    expect(row?.sent_at).not.toBeNull();
  });

  it(
    "tournament_entrants → UNION of entries.profile_id + team_members.profile_id, dedup'd",
    async () => {
      const a = admin();

      // Seed a tournament + 1 singles entry + 1 team with 3 members
      // (different profiles). Expect 4 recipients total (no overlap).

      // Seed players who will be entrants.
      const singlesPlayer = await createTestUser({
        role: "player",
        clubIds: [clubA],
      });
      users.push(singlesPlayer.id);
      const teamPlayers: string[] = [];
      for (let i = 0; i < 3; i++) {
        const u = await createTestUser({ role: "player", clubIds: [clubA] });
        users.push(u.id);
        teamPlayers.push(u.id);
      }

      // Tournament hosted by clubA.
      const { data: tournament, error: tErr } = await a
        .from("tournaments")
        .insert({
          host_club_id: clubA,
          name: "RPC SendMsg Tournament",
          scope: "club",
          format: "fours",
          structure: "knockout",
          category: "open",
          age_group: "open",
          handicap_rule: "scratch",
          status: "draft",
          starts_at: new Date(Date.now() + 86400000).toISOString(),
          ends_at: new Date(Date.now() + 86400000 * 2).toISOString(),
          created_by: adminA.id,
        })
        .select("id")
        .single();
      expect(tErr).toBeNull();
      const tournamentId = tournament!.id;

      // Singles-style entry (entries.profile_id populated).
      // Note: tournament_entries uses `team_name` for the entry
      // label (not `name` — that's tournament_teams).
      await a
        .from("tournament_entries")
        .insert({
          tournament_id: tournamentId,
          club_id: clubA,
          profile_id: singlesPlayer.id,
          team_name: "Singles Entry",
        })
        .throwOnError();

      // Withdrawn singles entry — must be excluded.
      const withdrawnPlayer = await createTestUser({
        role: "player",
        clubIds: [clubA],
      });
      users.push(withdrawnPlayer.id);
      await a
        .from("tournament_entries")
        .insert({
          tournament_id: tournamentId,
          club_id: clubA,
          profile_id: withdrawnPlayer.id,
          team_name: "Withdrawn Entry",
          withdrawn: true,
        })
        .throwOnError();

      // Team with 3 members.
      const { data: team } = await a
        .from("tournament_teams")
        .insert({
          tournament_id: tournamentId,
          club_id: clubA,
          name: "RPC SendMsg Team",
        })
        .select("id")
        .single();
      const teamId = team!.id;

      const positions = ["lead", "second", "skip"] as const;
      for (let i = 0; i < 3; i++) {
        await a
          .from("tournament_team_members")
          .insert({
            team_id: teamId,
            profile_id: teamPlayers[i],
            position: positions[i],
            bowl_order: i + 1,
          })
          .throwOnError();
      }

      // Withdrawn team — its 1 member must be excluded.
      const withdrawnTeamPlayer = await createTestUser({
        role: "player",
        clubIds: [clubA],
      });
      users.push(withdrawnTeamPlayer.id);
      const { data: wTeam } = await a
        .from("tournament_teams")
        .insert({
          tournament_id: tournamentId,
          club_id: clubA,
          name: "Withdrawn Team",
          withdrawn: true,
        })
        .select("id")
        .single();
      await a
        .from("tournament_team_members")
        .insert({
          team_id: wTeam!.id,
          profile_id: withdrawnTeamPlayer.id,
          position: "skip",
          bowl_order: 1,
        })
        .throwOnError();

      // Insert message with tournament_entrants audience.
      const { data: msg } = await a
        .from("messages")
        .insert({
          club_id: clubA,
          sender_id: adminA.id,
          subject: "Tournament reminder",
          body_md: "First round draws posted.",
          audience_kind: "tournament_entrants",
          audience_tournament_id: tournamentId,
          status: "queued",
        })
        .select("id")
        .single();
      const messageId = msg!.id;

      // Send.
      const adminUser = await createTestUser({
        role: "club_admin",
        clubIds: [clubA],
      });
      users.push(adminUser.id);
      const { client } = await signIn(adminUser);
      const { data, error } = await client.rpc("send_message", {
        p_message_id: messageId,
      });
      expect(error).toBeNull();
      expect(data?.[0]?.status).toBe("sent");
      expect(data?.[0]?.recipient_count).toBe(4); // 1 singles + 3 team members

      const { data: recipientProfiles } = await a
        .from("message_recipients")
        .select("profile_id")
        .eq("message_id", messageId);
      const recipientSet = new Set(
        (recipientProfiles ?? []).map((r) => r.profile_id),
      );
      expect(recipientSet.size).toBe(4);
      expect(recipientSet.has(singlesPlayer.id)).toBe(true);
      for (const id of teamPlayers) expect(recipientSet.has(id)).toBe(true);
      // Withdrawn entries / teams excluded.
      expect(recipientSet.has(withdrawnPlayer.id)).toBe(false);
      expect(recipientSet.has(withdrawnTeamPlayer.id)).toBe(false);
    },
  );

  it("custom audience intersects with active club members (non-members filtered)", async () => {
    const a = admin();

    // 3 club members + 1 outsider (member of clubB only).
    const m1 = await createTestUser({ role: "player", clubIds: [clubA] });
    const m2 = await createTestUser({ role: "player", clubIds: [clubA] });
    const m3 = await createTestUser({ role: "player", clubIds: [clubA] });
    const outsider = await createTestUser({
      role: "player",
      clubIds: [clubB],
    });
    users.push(m1.id, m2.id, m3.id, outsider.id);

    const { data: msg } = await a
      .from("messages")
      .insert({
        club_id: clubA,
        sender_id: adminA.id,
        subject: "Custom audience",
        body_md: "You three, please confirm.",
        audience_kind: "custom",
        audience_profile_ids: [m1.id, m2.id, m3.id, outsider.id],
        status: "queued",
      })
      .select("id")
      .single();
    const messageId = msg!.id;

    const adminUser = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminUser.id);
    const { client } = await signIn(adminUser);
    const { data, error } = await client.rpc("send_message", {
      p_message_id: messageId,
    });
    expect(error).toBeNull();
    expect(data?.[0]?.status).toBe("sent");
    expect(data?.[0]?.recipient_count).toBe(3); // outsider filtered

    const { data: recipientProfiles } = await a
      .from("message_recipients")
      .select("profile_id")
      .eq("message_id", messageId);
    const ids = new Set((recipientProfiles ?? []).map((r) => r.profile_id));
    expect(ids.has(outsider.id)).toBe(false);
  });
});

describe("RPC · public.send_message — idempotency + failure paths", () => {
  let clubA: string;
  let adminA: { id: string };

  beforeAll(async () => {
    clubA = await seedClub("RPC SendMsg Idem");
    clubs.push(clubA);
    const a = await createTestUser({ role: "club_admin", clubIds: [clubA] });
    users.push(a.id);
    adminA = { id: a.id };
  });

  it("re-calling on status='sent' returns the cached count without inserting duplicates", async () => {
    const a = admin();
    const member = await createTestUser({
      role: "player",
      clubIds: [clubA],
    });
    users.push(member.id);

    const { data: msg } = await a
      .from("messages")
      .insert({
        club_id: clubA,
        sender_id: adminA.id,
        subject: "Idem",
        body_md: "Body",
        audience_kind: "all_members",
        status: "queued",
      })
      .select("id")
      .single();
    const messageId = msg!.id;

    const adminUser = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminUser.id);
    const { client } = await signIn(adminUser);

    const first = await client.rpc("send_message", { p_message_id: messageId });
    expect(first.error).toBeNull();
    expect(first.data?.[0]?.status).toBe("sent");
    const firstCount = first.data?.[0]?.recipient_count ?? 0;
    expect(firstCount).toBeGreaterThanOrEqual(1);

    const second = await client.rpc("send_message", { p_message_id: messageId });
    expect(second.error).toBeNull();
    expect(second.data?.[0]?.status).toBe("sent");
    expect(second.data?.[0]?.recipient_count).toBe(firstCount);

    // No duplicate recipient rows (UNIQUE constraint enforces this anyway).
    const { count: rCount } = await a
      .from("message_recipients")
      .select("*", { count: "exact", head: true })
      .eq("message_id", messageId);
    expect(rCount).toBe(firstCount);

    // Notifications: count must equal firstCount (no second-pass duplication).
    const { count: nCount } = await a
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("related_id", messageId);
    expect(nCount).toBe(firstCount);
  });

  it("audience_kind='tournament_entrants' with NULL tournament_id transitions to status='failed'", async () => {
    const a = admin();
    const { data: msg } = await a
      .from("messages")
      .insert({
        club_id: clubA,
        sender_id: adminA.id,
        subject: "Bad audience",
        body_md: "Body",
        audience_kind: "tournament_entrants",
        audience_tournament_id: null,
        status: "queued",
      })
      .select("id")
      .single();
    const messageId = msg!.id;

    const adminUser = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminUser.id);
    const { client } = await signIn(adminUser);
    const { data, error } = await client.rpc("send_message", {
      p_message_id: messageId,
    });
    expect(error).toBeNull();
    expect(data?.[0]?.status).toBe("failed");
    expect(data?.[0]?.recipient_count).toBe(0);

    const { data: row } = await a
      .from("messages")
      .select("status, recipient_count, sent_at")
      .eq("id", messageId)
      .single();
    expect(row?.status).toBe("failed");
    expect(row?.recipient_count).toBe(0);
    // sent_at stays null since no fan-out happened.
    expect(row?.sent_at).toBeNull();
  });

  it("club_admin of a different club cannot send (42501 wrong_club)", async () => {
    const a = admin();
    const otherClub = await seedClub("RPC SendMsg Other");
    clubs.push(otherClub);

    const { data: msg } = await a
      .from("messages")
      .insert({
        club_id: clubA,
        sender_id: adminA.id,
        subject: "Cross",
        body_md: "Body",
        audience_kind: "all_members",
        status: "queued",
      })
      .select("id")
      .single();

    const otherAdmin = await createTestUser({
      role: "club_admin",
      clubIds: [otherClub],
    });
    users.push(otherAdmin.id);
    const { client } = await signIn(otherAdmin);
    const { error } = await client.rpc("send_message", {
      p_message_id: msg!.id,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(error?.message ?? "").toContain("wrong_club");
  });

  it("rejects status='draft' with 22023 wrong_state", async () => {
    const a = admin();
    const { data: msg } = await a
      .from("messages")
      .insert({
        club_id: clubA,
        sender_id: adminA.id,
        subject: "Draft",
        body_md: "Body",
        audience_kind: "all_members",
        status: "draft",
      })
      .select("id")
      .single();

    const adminUser = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminUser.id);
    const { client } = await signIn(adminUser);
    const { error } = await client.rpc("send_message", {
      p_message_id: msg!.id,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("22023");
    expect(error?.message ?? "").toContain("wrong_state");
  });
});
