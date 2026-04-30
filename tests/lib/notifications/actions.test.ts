import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockUpdateEq = vi.fn();
const mockFrom = vi.fn(() => ({
  update: () => ({ eq: mockUpdateEq }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mockFrom }),
}));

import {
  markMessageRecipientRead,
  markNotificationRead,
} from "@/lib/notifications/actions";

const VALID_ID = "00000000-0000-4000-8000-000000000001";

afterEach(() => {
  mockUpdateEq.mockReset();
  mockFrom.mockClear();
});

describe("markNotificationRead", () => {
  it("updates the row and returns ok:true on happy path", async () => {
    mockUpdateEq.mockResolvedValueOnce({ data: null, error: null });
    const result = await markNotificationRead(VALID_ID);
    expect(result).toEqual({ ok: true });
    expect(mockFrom).toHaveBeenCalledWith("notifications");
    expect(mockUpdateEq).toHaveBeenCalledTimes(1);
  });

  it("returns validation for a non-UUID id", async () => {
    const result = await markNotificationRead("not-a-uuid");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("validation");
    expect(mockUpdateEq).not.toHaveBeenCalled();
  });

  it("surfaces DB errors as kind='error'", async () => {
    mockUpdateEq.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied" },
    });
    const result = await markNotificationRead(VALID_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("error");
      expect(result.error).toBe("permission denied");
    }
  });
});

describe("markMessageRecipientRead", () => {
  it("updates the row and returns ok:true on happy path", async () => {
    mockUpdateEq.mockResolvedValueOnce({ data: null, error: null });
    const result = await markMessageRecipientRead(VALID_ID);
    expect(result).toEqual({ ok: true });
    expect(mockFrom).toHaveBeenCalledWith("message_recipients");
  });

  it("returns validation for a non-UUID id", async () => {
    const result = await markMessageRecipientRead("not-a-uuid");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("validation");
    expect(mockUpdateEq).not.toHaveBeenCalled();
  });

  it("surfaces DB errors as kind='error'", async () => {
    mockUpdateEq.mockResolvedValueOnce({
      data: null,
      error: { message: "RLS denied" },
    });
    const result = await markMessageRecipientRead(VALID_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("error");
  });
});
