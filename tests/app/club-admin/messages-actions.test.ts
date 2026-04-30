import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ---------- mocks ----------
const mockGetAuthContext = vi.fn();
vi.mock("@/lib/auth/role", () => ({
  getAuthContext: () => mockGetAuthContext(),
}));

const mockGetCurrentHostClub = vi.fn();
vi.mock("@/lib/auth/memberships", () => ({
  getCurrentHostClub: () => mockGetCurrentHostClub(),
}));

const mockSendMessage = vi.fn();
vi.mock("@/lib/messages/actions", () => ({
  sendMessage: (input: unknown) => mockSendMessage(input),
}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const redirectMock = vi.fn((url: string) => {
  // Mirror Next's redirect — throw a control-flow error so the calling
  // function unwinds. Tests catch it explicitly.
  throw new Error(`redirect:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

// Supabase client builder mock — assembles per-call expectations.
const mockInsertSelectSingle = vi.fn();
const mockUpdateEq = vi.fn();
const mockSelectMaybeSingle = vi.fn();
const mockDeleteEq = vi.fn();
const mockFrom = vi.fn(() => ({
  insert: () => ({
    select: () => ({ single: mockInsertSelectSingle }),
  }),
  update: () => ({ eq: mockUpdateEq }),
  select: () => ({
    eq: () => ({ maybeSingle: mockSelectMaybeSingle }),
  }),
  delete: () => ({ eq: mockDeleteEq }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mockFrom }),
}));

// ---------- imports under test ----------
import {
  createMessageDraft,
  deleteMessageDraft,
  scheduleMessage,
  sendMessageNow,
  updateMessageDraft,
} from "@/app/(club-admin)/manage/messages/_actions";

// RFC 4122 v4 UUIDs — version nibble = 4, variant nibble in {8,9,a,b}.
// Zod's .uuid() validator rejects non-conforming shapes.
const PROFILE = "00000000-0000-4000-8000-0000000000aa";
const CLUB = "11111111-1111-4111-8111-111111111111";
const MSG = "22222222-2222-4222-8222-222222222222";

beforeAll(() => {
  mockGetAuthContext.mockResolvedValue({
    userId: PROFILE,
    role: "club_admin",
    clubIds: [CLUB],
    email: "admin@example.com",
  });
  mockGetCurrentHostClub.mockResolvedValue({
    club_id: CLUB,
    club_name: "Demo Bowls Club",
    club_theme_preset: "atomic-red",
  });
});

afterEach(() => {
  mockInsertSelectSingle.mockReset();
  mockUpdateEq.mockReset();
  mockSelectMaybeSingle.mockReset();
  mockDeleteEq.mockReset();
  mockFrom.mockClear();
  mockSendMessage.mockReset();
  mockRevalidatePath.mockClear();
  redirectMock.mockClear();
});

// ---------- createMessageDraft ----------

describe("createMessageDraft", () => {
  it("inserts a draft with send_in_app=true and send_email=false (locked decision #3)", async () => {
    let captured: Record<string, unknown> | null = null;
    mockFrom.mockImplementationOnce(() => ({
      insert: (payload: Record<string, unknown>) => {
        captured = payload;
        return {
          select: () => ({
            single: vi.fn().mockResolvedValue({
              data: { id: MSG },
              error: null,
            }),
          }),
        };
      },
    }) as unknown as ReturnType<typeof mockFrom>);

    const result = await createMessageDraft({
      subject: "Hi",
      body_md: "Body",
      audience_kind: "all_members",
    });

    expect(result).toEqual({ kind: "ok", messageId: MSG });
    expect(captured).not.toBeNull();
    expect(captured!.send_in_app).toBe(true);
    expect(captured!.send_email).toBe(false);
    expect(captured!.status).toBe("draft");
    expect(captured!.club_id).toBe(CLUB);
    expect(captured!.sender_id).toBe(PROFILE);
  });

  it("returns validation when subject is empty", async () => {
    const result = await createMessageDraft({
      subject: "",
      body_md: "Body",
      audience_kind: "all_members",
    });
    expect(result.kind).toBe("validation");
  });

  it("returns validation when body_md exceeds 5000 chars", async () => {
    const result = await createMessageDraft({
      subject: "Subject",
      body_md: "x".repeat(5001),
      audience_kind: "all_members",
    });
    expect(result.kind).toBe("validation");
  });

  it("returns validation when audience_kind=tournament_entrants without tournament_id", async () => {
    const result = await createMessageDraft({
      subject: "Subject",
      body_md: "Body",
      audience_kind: "tournament_entrants",
      // audience_tournament_id missing
    });
    expect(result.kind).toBe("validation");
  });

  it("returns auth when no auth context", async () => {
    mockGetAuthContext.mockResolvedValueOnce(null);
    const result = await createMessageDraft({
      subject: "Subject",
      body_md: "Body",
      audience_kind: "all_members",
    });
    expect(result.kind).toBe("auth");
  });

  it("returns no_club when no host club", async () => {
    mockGetCurrentHostClub.mockResolvedValueOnce(null);
    const result = await createMessageDraft({
      subject: "Subject",
      body_md: "Body",
      audience_kind: "all_members",
    });
    expect(result.kind).toBe("no_club");
  });
});

// ---------- updateMessageDraft ----------

describe("updateMessageDraft", () => {
  it("rejects updates when status is not 'draft'", async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: { id: MSG, status: "sent" },
      error: null,
    });
    const result = await updateMessageDraft(MSG, {
      subject: "Edit",
      body_md: "Body",
      audience_kind: "all_members",
    });
    expect(result.kind).toBe("wrong_state");
  });

  it("returns not_found when row missing", async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await updateMessageDraft(MSG, {
      subject: "Edit",
      body_md: "Body",
      audience_kind: "all_members",
    });
    expect(result.kind).toBe("not_found");
  });

  it("updates a draft on the happy path", async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: { id: MSG, status: "draft" },
      error: null,
    });
    mockUpdateEq.mockResolvedValueOnce({ data: null, error: null });
    const result = await updateMessageDraft(MSG, {
      subject: "Edit",
      body_md: "Body",
      audience_kind: "all_members",
    });
    expect(result.kind).toBe("ok");
  });
});

// ---------- sendMessageNow ----------

describe("sendMessageNow", () => {
  it("transitions draft → queued, calls sendMessage, returns recipient count", async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: { id: MSG, status: "draft" },
      error: null,
    });
    mockUpdateEq.mockResolvedValueOnce({ data: null, error: null });
    mockSendMessage.mockResolvedValueOnce({ ok: true, recipientCount: 12 });

    const result = await sendMessageNow(MSG);
    expect(result).toEqual({ kind: "ok", recipientCount: 12 });
    expect(mockSendMessage).toHaveBeenCalledWith({ messageId: MSG });
  });

  it("rejects with wrong_state when message is not draft", async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: { id: MSG, status: "sent" },
      error: null,
    });
    const result = await sendMessageNow(MSG);
    expect(result.kind).toBe("wrong_state");
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("maps sendMessage's audience_invalid kind through", async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: { id: MSG, status: "draft" },
      error: null,
    });
    mockUpdateEq.mockResolvedValueOnce({ data: null, error: null });
    mockSendMessage.mockResolvedValueOnce({
      ok: false,
      kind: "audience_invalid",
      error: "Audience resolution failed",
    });
    const result = await sendMessageNow(MSG);
    expect(result.kind).toBe("audience_invalid");
  });

  it("maps sendMessage's forbidden kind through", async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: { id: MSG, status: "draft" },
      error: null,
    });
    mockUpdateEq.mockResolvedValueOnce({ data: null, error: null });
    mockSendMessage.mockResolvedValueOnce({
      ok: false,
      kind: "forbidden",
      error: "wrong_club",
    });
    const result = await sendMessageNow(MSG);
    expect(result.kind).toBe("forbidden");
  });
});

// ---------- scheduleMessage ----------

describe("scheduleMessage", () => {
  it("rejects past scheduled_at", async () => {
    const result = await scheduleMessage(MSG, {
      scheduled_at: "2020-01-01T00:00:00Z",
    });
    expect(result.kind).toBe("validation");
  });

  it("rejects when message is not draft", async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: { id: MSG, status: "queued" },
      error: null,
    });
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const result = await scheduleMessage(MSG, { scheduled_at: future });
    expect(result.kind).toBe("wrong_state");
  });

  it("transitions draft → queued with scheduled_at on the happy path", async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: { id: MSG, status: "draft" },
      error: null,
    });
    mockUpdateEq.mockResolvedValueOnce({ data: null, error: null });
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const result = await scheduleMessage(MSG, { scheduled_at: future });
    expect(result.kind).toBe("ok");
  });
});

// ---------- deleteMessageDraft ----------

describe("deleteMessageDraft", () => {
  it("rejects when message is not draft", async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: { id: MSG, status: "sent" },
      error: null,
    });
    const result = await deleteMessageDraft(MSG);
    expect(result.kind).toBe("wrong_state");
    expect(mockDeleteEq).not.toHaveBeenCalled();
  });

  it("deletes on happy path", async () => {
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: { id: MSG, status: "draft" },
      error: null,
    });
    mockDeleteEq.mockResolvedValueOnce({ data: null, error: null });
    const result = await deleteMessageDraft(MSG);
    expect(result.kind).toBe("ok");
  });
});
