import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ---------- mocks ----------
const mockGetAuthContext = vi.fn();
vi.mock("@/lib/auth/role", () => ({
  getAuthContext: () => mockGetAuthContext(),
}));

const mockSendInviteEmail = vi.fn();
vi.mock("@/lib/invites/email", () => ({
  sendInviteEmail: (input: unknown) => mockSendInviteEmail(input),
}));

// Service-client builder mock — only the inserts/select chain we
// exercise. Each test wires its own resolver into mockInsertSingle.
const mockInsertSingle = vi.fn();
const mockServiceFrom = vi.fn(() => ({
  insert: () => ({
    select: () => ({ single: mockInsertSingle }),
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: mockServiceFrom }),
}));

// Authed server client — only used by createPlayerInvitesBatch via
// supabase.rpc; not by createInvite. Stub it so this file's tests
// don't accidentally hit a real client init.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: vi.fn() }),
}));

import { createInvite } from "@/lib/invites/actions";

const ADMIN_PROFILE = "00000000-0000-4000-8000-0000000000aa";
const CLUB = "11111111-1111-4111-8111-111111111111";
const NEW_INVITE_ID = "22222222-2222-4222-8222-222222222222";
const NEW_INVITE_TOKEN = "test-token-abc123def456";

beforeAll(() => {
  mockGetAuthContext.mockResolvedValue({
    userId: ADMIN_PROFILE,
    role: "club_admin",
    clubIds: [CLUB],
    email: "admin@example.com",
  });
});

afterEach(() => {
  mockInsertSingle.mockReset();
  mockServiceFrom.mockClear();
  mockSendInviteEmail.mockReset();
});

// Phase 11 / 11-4a — createInvite triggers InviteEmail, with the
// invite row persisting regardless of email outcome.
//
// Coverage:
//   1. Invite row insert + email send happy path
//   2. Email failure does NOT roll back the invite row
//   3. sendInviteEmail receives the freshly-minted token
//   4. Invitee's display-name hint is forwarded
//   5. Validation rejects don't reach the email helper
//   6. Auth rejects don't reach the email helper

describe("createInvite — email wiring", () => {
  it("emails the invite after a successful row insert (happy path)", async () => {
    mockInsertSingle.mockResolvedValueOnce({
      data: { id: NEW_INVITE_ID, token: NEW_INVITE_TOKEN },
      error: null,
    });
    mockSendInviteEmail.mockResolvedValueOnce({
      status: "sent",
      emailId: "re_email_123",
    });

    const result = await createInvite({
      club_id: CLUB,
      email: "Player@Example.com",
      role: "player",
      first_name: "James",
      last_name: "Thomas",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.invite_id).toBe(NEW_INVITE_ID);
      expect(result.data.token).toBe(NEW_INVITE_TOKEN);
      expect(result.data.email_status).toBe("sent");
      expect(result.data.email_error).toBeUndefined();
    }
    expect(mockSendInviteEmail).toHaveBeenCalledTimes(1);
    expect(mockSendInviteEmail).toHaveBeenCalledWith({
      token: NEW_INVITE_TOKEN,
      invitedByDisplayName: "admin@example.com",
    });
  });

  it("POPIA opt-out: existing profile with email_opt_in=false → email_status='skipped' (11-6)", async () => {
    mockInsertSingle.mockResolvedValueOnce({
      data: { id: NEW_INVITE_ID, token: NEW_INVITE_TOKEN },
      error: null,
    });
    mockSendInviteEmail.mockResolvedValueOnce({
      status: "skipped",
      reason: "opted_out",
    });

    const result = await createInvite({
      club_id: CLUB,
      email: "opted-out@example.com",
      role: "player",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Invite row written.
      expect(result.data.invite_id).toBe(NEW_INVITE_ID);
      expect(result.data.token).toBe(NEW_INVITE_TOKEN);
      // Email skipped per POPIA opt-out gate.
      expect(result.data.email_status).toBe("skipped");
      // Reason marker thread through error field for UI branching.
      expect(result.data.email_error).toBe("opted_out:opted_out");
    }
  });

  it("non-blocking on email failure: row stays, status='failed', error surfaced", async () => {
    mockInsertSingle.mockResolvedValueOnce({
      data: { id: NEW_INVITE_ID, token: NEW_INVITE_TOKEN },
      error: null,
    });
    mockSendInviteEmail.mockResolvedValueOnce({
      status: "failed",
      reason: "send_failed",
      error: "domain not verified",
    });

    const result = await createInvite({
      club_id: CLUB,
      email: "player@example.com",
      role: "player",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Row write succeeded.
      expect(result.data.invite_id).toBe(NEW_INVITE_ID);
      expect(result.data.token).toBe(NEW_INVITE_TOKEN);
      // Email-side failure surfaced for the UI.
      expect(result.data.email_status).toBe("failed");
      expect(result.data.email_error).toBe("domain not verified");
    }
  });

  it("forwards the inviting admin's email as the display-name hint", async () => {
    mockInsertSingle.mockResolvedValueOnce({
      data: { id: NEW_INVITE_ID, token: NEW_INVITE_TOKEN },
      error: null,
    });
    mockSendInviteEmail.mockResolvedValueOnce({
      status: "sent",
      emailId: "re_email_456",
    });

    await createInvite({
      club_id: CLUB,
      email: "player@example.com",
      role: "player",
    });

    expect(mockSendInviteEmail.mock.calls[0][0].invitedByDisplayName).toBe(
      "admin@example.com",
    );
  });

  it("validation reject does NOT call sendInviteEmail", async () => {
    const result = await createInvite({
      // Missing required fields → Zod fails.
      club_id: "not-a-uuid",
      email: "player@example.com",
      role: "player",
    });

    expect(result.ok).toBe(false);
    expect(mockSendInviteEmail).not.toHaveBeenCalled();
  });

  it("auth reject does NOT call sendInviteEmail", async () => {
    mockGetAuthContext.mockResolvedValueOnce(null);
    const result = await createInvite({
      club_id: CLUB,
      email: "player@example.com",
      role: "player",
    });

    expect(result.ok).toBe(false);
    expect(mockSendInviteEmail).not.toHaveBeenCalled();
  });

  it("forbidden (club_admin not owning club_id) does NOT call sendInviteEmail", async () => {
    mockGetAuthContext.mockResolvedValueOnce({
      userId: ADMIN_PROFILE,
      role: "club_admin",
      clubIds: ["33333333-3333-4333-8333-333333333333"],
      email: "admin@example.com",
    });
    const result = await createInvite({
      club_id: CLUB,
      email: "player@example.com",
      role: "player",
    });

    expect(result.ok).toBe(false);
    expect(mockSendInviteEmail).not.toHaveBeenCalled();
  });

  it("DB insert error surfaces ok:false and skips the email", async () => {
    mockInsertSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "duplicate key" },
    });

    const result = await createInvite({
      club_id: CLUB,
      email: "player@example.com",
      role: "player",
    });

    expect(result.ok).toBe(false);
    expect(mockSendInviteEmail).not.toHaveBeenCalled();
  });
});
