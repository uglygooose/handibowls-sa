import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSbClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { AuthContext } from "@/lib/auth/role";

// Phase 13 / 13-2 / Batch B1b — DRIFT-L269 closure.
//
// Real-database integration test for sendMessageNow — the
// admin-action wrapper that transitions a draft message → queued
// then invokes the public.send_message RPC. The RPC has full
// RLS-mode coverage at tests/rpc/send-message.test.ts; this test
// pins the action wrapper's full call shape end-to-end (auth →
// uuid validation → state guard → UPDATE → RPC fan-out → result
// mapping → revalidatePath).
//
// Pattern lifted from tests/integration/actions/t20-finalize.test.ts.

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    setAll: () => {},
  }),
  headers: async () => new Map(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const e = new Error(`NEXT_REDIRECT;${url}`);
    (e as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
    throw e;
  },
}));

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ctxHolder: {
  ctx: AuthContext | null;
  client: ReturnType<typeof createSbClient<Database>> | null;
} = { ctx: null, client: null };

vi.mock("@/lib/auth/role", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/role")>();
  return {
    ...actual,
    getAuthContext: async () => ctxHolder.ctx,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ctxHolder.client,
}));

import { admin, cleanup, createTestUser, seedClub, signIn } from "../../rls/helpers";

const { sendMessageNow } = await import(
  "@/app/(club-admin)/manage/messages/_actions"
);

const users: string[] = [];
const clubs: string[] = [];

afterAll(() => cleanup(users, clubs));

describe("sendMessageNow · live RPC path (DRIFT-L269)", () => {
  let clubA: string;
  let clubB: string;

  beforeAll(async () => {
    clubA = await seedClub("Send Message A");
    clubB = await seedClub("Send Message B");
    clubs.push(clubA, clubB);
  });

  // Seed a draft message at the given club, sender = adminId,
  // audience = all_members. Returns the message id.
  async function seedDraftMessage(opts: {
    clubId: string;
    senderId: string;
    subject?: string;
  }): Promise<string> {
    const { data: msg } = await admin()
      .from("messages")
      .insert({
        club_id: opts.clubId,
        sender_id: opts.senderId,
        subject: opts.subject ?? "Test broadcast",
        body_md: "Test body",
        audience_kind: "all_members",
        status: "draft",
      })
      .select("id")
      .single()
      .throwOnError();
    return msg!.id;
  }

  function bindClientFor(token: string) {
    return createSbClient<Database>(URL, ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });
  }

  it("transitions draft → sent and returns recipientCount > 0 for an all_members message at the admin's club (kind='ok')", async () => {
    const adminUser = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminUser.id);

    // Seed 3 active members (the admin's own membership counts as 1 too).
    const memberIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const u = await createTestUser({ role: "player", clubIds: [clubA] });
      users.push(u.id);
      memberIds.push(u.id);
    }

    const messageId = await seedDraftMessage({
      clubId: clubA,
      senderId: adminUser.id,
    });

    const session = await signIn(adminUser);
    ctxHolder.ctx = {
      userId: adminUser.id,
      role: "club_admin",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubA],
      email: adminUser.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await sendMessageNow(messageId);

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      // 3 seeded players + 1 admin (also a club_member as part of
      // createTestUser({role: club_admin, clubIds:[clubA]}) wiring? —
      // actually club_admin uses club_admin_assignments, not
      // club_memberships. So only the 3 seeded players are members.
      expect(result.recipientCount).toBeGreaterThanOrEqual(3);
    }

    const { data: row } = await admin()
      .from("messages")
      .select("status, sent_at, recipient_count")
      .eq("id", messageId)
      .single();
    expect(row?.status).toBe("sent");
    expect(row?.sent_at).not.toBeNull();
    expect(row?.recipient_count).toBeGreaterThanOrEqual(3);
  }, 30_000);

  it("returns kind='wrong_state' when called on a message already in 'sent' status", async () => {
    const adminUser = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminUser.id);

    // Insert a message directly at status='sent' to skip the send.
    const { data: msg } = await admin()
      .from("messages")
      .insert({
        club_id: clubA,
        sender_id: adminUser.id,
        subject: "Already sent",
        body_md: "Body",
        audience_kind: "all_members",
        status: "sent",
        sent_at: new Date().toISOString(),
        recipient_count: 0,
      })
      .select("id")
      .single()
      .throwOnError();
    const messageId = msg!.id;

    const session = await signIn(adminUser);
    ctxHolder.ctx = {
      userId: adminUser.id,
      role: "club_admin",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubA],
      email: adminUser.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await sendMessageNow(messageId);
    expect(result.kind).toBe("wrong_state");
  }, 30_000);

  it("returns kind='not_found' when admin from club B tries to send a message belonging to club A (cross-club RLS)", async () => {
    const adminA = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    const adminB = await createTestUser({
      role: "club_admin",
      clubIds: [clubB],
    });
    users.push(adminA.id, adminB.id);

    const messageId = await seedDraftMessage({
      clubId: clubA,
      senderId: adminA.id,
      subject: "Club A draft",
    });

    // Sign in as adminB — RLS should hide messages.club_id=A.
    const session = await signIn(adminB);
    ctxHolder.ctx = {
      userId: adminB.id,
      role: "club_admin",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubB],
      email: adminB.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await sendMessageNow(messageId);
    expect(result.kind).toBe("not_found");
  }, 30_000);

  it("returns kind='validation' for a non-UUID id", async () => {
    const adminUser = await createTestUser({
      role: "club_admin",
      clubIds: [clubA],
    });
    users.push(adminUser.id);

    const session = await signIn(adminUser);
    ctxHolder.ctx = {
      userId: adminUser.id,
      role: "club_admin",
      clubIds: (session.jwt.app_metadata.club_ids as string[]) ?? [clubA],
      email: adminUser.email,
    };
    ctxHolder.client = bindClientFor(session.token);

    const result = await sendMessageNow("not-a-uuid");
    expect(result.kind).toBe("validation");
  }, 30_000);

  it("returns kind='auth' when ctxHolder has no AuthContext", async () => {
    ctxHolder.ctx = null;
    ctxHolder.client = null;
    const result = await sendMessageNow("00000000-0000-0000-0000-000000000000");
    expect(result.kind).toBe("auth");
  }, 30_000);
});
