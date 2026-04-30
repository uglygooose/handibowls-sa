import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock the service-role client BEFORE importing the action so the
// action sees the mock. Each test sets up the mock chain it needs.
const mockMaybeSingleProfile = vi.fn();
const mockUpdateEq = vi.fn();
const mockFromBuilder = vi.fn(() => ({
  select: () => ({
    eq: () => ({
      maybeSingle: mockMaybeSingleProfile,
    }),
  }),
  update: () => ({
    eq: mockUpdateEq,
  }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: mockFromBuilder,
  }),
}));

import { unsubscribeFromEmails } from "@/lib/email/actions";
import { generateUnsubscribeToken } from "@/lib/email/unsubscribe";

const PROFILE_A = "00000000-0000-0000-0000-0000000000aa";

beforeAll(() => {
  process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

afterEach(() => {
  mockMaybeSingleProfile.mockReset();
  mockUpdateEq.mockReset();
  mockFromBuilder.mockClear();
});

describe("unsubscribeFromEmails", () => {
  it("returns invalid_token for an unparseable token", async () => {
    const result = await unsubscribeFromEmails("not-a-real-token");
    expect(result).toEqual({ ok: false, kind: "invalid_token" });
    expect(mockFromBuilder).not.toHaveBeenCalled();
  });

  it("returns invalid_token when the profile does not exist (HMAC valid)", async () => {
    const token = await generateUnsubscribeToken({ profileId: PROFILE_A });
    mockMaybeSingleProfile.mockResolvedValueOnce({ data: null, error: null });

    const result = await unsubscribeFromEmails(token);
    expect(result).toEqual({ ok: false, kind: "invalid_token" });
    // Read happened, write did not.
    expect(mockUpdateEq).not.toHaveBeenCalled();
  });

  it("returns already_unsubscribed when email_opt_in is already false", async () => {
    const token = await generateUnsubscribeToken({ profileId: PROFILE_A });
    mockMaybeSingleProfile.mockResolvedValueOnce({
      data: { id: PROFILE_A, email_opt_in: false },
      error: null,
    });

    const result = await unsubscribeFromEmails(token);
    expect(result).toEqual({ ok: false, kind: "already_unsubscribed" });
    expect(mockUpdateEq).not.toHaveBeenCalled();
  });

  it("flips email_opt_in to false on a fresh unsubscribe", async () => {
    const token = await generateUnsubscribeToken({ profileId: PROFILE_A });
    mockMaybeSingleProfile.mockResolvedValueOnce({
      data: { id: PROFILE_A, email_opt_in: true },
      error: null,
    });
    mockUpdateEq.mockResolvedValueOnce({ data: null, error: null });

    const result = await unsubscribeFromEmails(token);
    expect(result).toEqual({ ok: true });
    expect(mockUpdateEq).toHaveBeenCalledTimes(1);
  });

  it("returns db_error when the profile read fails", async () => {
    const token = await generateUnsubscribeToken({ profileId: PROFILE_A });
    mockMaybeSingleProfile.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });

    const result = await unsubscribeFromEmails(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("db_error");
      expect(result.error).toBe("boom");
    }
    expect(mockUpdateEq).not.toHaveBeenCalled();
  });

  it("returns db_error when the profile update fails", async () => {
    const token = await generateUnsubscribeToken({ profileId: PROFILE_A });
    mockMaybeSingleProfile.mockResolvedValueOnce({
      data: { id: PROFILE_A, email_opt_in: true },
      error: null,
    });
    mockUpdateEq.mockResolvedValueOnce({
      data: null,
      error: { message: "update failed" },
    });

    const result = await unsubscribeFromEmails(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("db_error");
      expect(result.error).toBe("update failed");
    }
  });
});
