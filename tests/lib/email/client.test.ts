import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Phase 13 / 13-7 — graceful-failure coverage for lib/email/client.ts:
// sendEmail. Tests pin the discriminated `{ok,kind,error}` shape that
// callers (lib/invites/email.ts) rely on so they can record non-fatal
// failure status without throwing user-facing errors.
//
// We mock the Resend SDK at the module boundary so no real API calls
// fly. `vi.hoisted()` is the canonical pattern for sharing a mock
// reference between the hoisted `vi.mock` factory and the test body —
// vi.mock is hoisted above any `const` declarations, so a top-level
// `const sendMock = vi.fn()` would be undefined inside the factory.

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("resend", () => {
  // Class-based mock — more robust than vi.fn().mockImplementation for
  // constructor calls. Resend's real export is `class Resend`, so we
  // mirror that shape.
  return {
    Resend: class MockResend {
      emails = { send: sendMock };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_apiKey: string) {}
    },
  };
});

import {
  __resetResendClientForTests,
  sendEmail,
} from "@/lib/email/client";

beforeEach(() => {
  sendMock.mockReset();
  __resetResendClientForTests();
  process.env.RESEND_API_KEY = "test-api-key";
  process.env.RESEND_FROM = "Test <test@example.test>";
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
});

describe("sendEmail — config failures", () => {
  it("returns kind='config' when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await sendEmail({
      to: "alice@example.test",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.kind).toBe("config");
    expect(result.error).toContain("RESEND_API_KEY");
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain("[email:skipped]");
    expect(warn.mock.calls[0]?.[0]).toContain("kind=config");
    warn.mockRestore();
  });

  it("returns kind='config' when RESEND_FROM is missing and no override is provided", async () => {
    delete process.env.RESEND_FROM;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await sendEmail({
      to: "alice@example.test",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.kind).toBe("config");
    expect(result.error).toContain("RESEND_FROM");
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain("[email:skipped]");
    warn.mockRestore();
  });
});

describe("sendEmail — Resend API failures", () => {
  it("classifies invalid_from_address as kind='domain_not_verified'", async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: {
        name: "invalid_from_address",
        message: "The handibowls.co.za domain is not verified",
      },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await sendEmail({
      to: "alice@example.test",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.kind).toBe("domain_not_verified");
    expect(warn.mock.calls[0]?.[0]).toContain("kind=domain_not_verified");
    warn.mockRestore();
  });

  it("classifies restricted_api_key (sandbox) as kind='domain_not_verified'", async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: {
        name: "restricted_api_key",
        message: "API key is restricted to verified recipients",
      },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await sendEmail({
      to: "alice@example.test",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.kind).toBe("domain_not_verified");
    warn.mockRestore();
  });

  it("classifies rate-limit errors as kind='rate_limit'", async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: "rate_limit_exceeded", message: "too many requests" },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await sendEmail({
      to: "alice@example.test",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.kind).toBe("rate_limit");
    warn.mockRestore();
  });

  it("classifies fetch/transport throws as kind='network'", async () => {
    sendMock.mockRejectedValueOnce(new Error("fetch failed: ECONNREFUSED"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await sendEmail({
      to: "alice@example.test",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.kind).toBe("network");
    expect(result.error).toContain("ECONNREFUSED");
    expect(warn.mock.calls[0]?.[0]).toContain("kind=network");
    warn.mockRestore();
  });

  it("returns ok:true with the Resend message id on success — no skip-log", async () => {
    sendMock.mockResolvedValueOnce({
      data: { id: "re_abc123" },
      error: null,
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await sendEmail({
      to: "alice@example.test",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.id).toBe("re_abc123");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
