import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildUnsubscribeUrl,
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/lib/email/unsubscribe";

// Phase 11 / 11-1 — POPIA HMAC unsubscribe token contract.
//
// Covers
//   1. Round-trip: a freshly generated token verifies and decodes back
//      to the original profileId / clubId / expiresAt.
//   2. Tamper rejection: any single-byte mutation of either segment
//      causes verification to fail.
//   3. Expiry: a token with a TTL in the past returns null even when
//      the signature is otherwise valid.
//   4. Forgery rejection: a token signed with a different secret
//      cannot be verified.
//   5. Malformed input: missing dot, non-base64url chars, empty
//      strings, etc.
//   6. URL builder: produces the expected /email/unsubscribe?t=…
//      surface and round-trips through URL encoding.

const PROFILE_A = "00000000-0000-0000-0000-0000000000aa";
const PROFILE_B = "11111111-1111-1111-1111-1111111111bb";
const CLUB_A = "00000000-0000-0000-0000-000000000c1c";

beforeAll(() => {
  // Stable signing key for the suite — 64 hex chars (256 bits).
  process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

describe("generateUnsubscribeToken / verifyUnsubscribeToken — round-trip", () => {
  it("returns the same profileId and clubId when verified", async () => {
    const token = await generateUnsubscribeToken({
      profileId: PROFILE_A,
      clubId: CLUB_A,
      nowMs: 1_700_000_000_000,
    });
    const verified = await verifyUnsubscribeToken(token, {
      nowMs: 1_700_000_000_000,
    });
    expect(verified).not.toBeNull();
    expect(verified?.profileId).toBe(PROFILE_A);
    expect(verified?.clubId).toBe(CLUB_A);
    expect(verified?.expiresAt).toBe(
      Math.floor(1_700_000_000_000 / 1000) + 30 * 24 * 60 * 60,
    );
  });

  it("supports a null clubId for platform-level invites", async () => {
    const token = await generateUnsubscribeToken({
      profileId: PROFILE_B,
      clubId: null,
    });
    const verified = await verifyUnsubscribeToken(token);
    expect(verified?.clubId).toBeNull();
    expect(verified?.profileId).toBe(PROFILE_B);
  });

  it("respects an explicit ttlSeconds override", async () => {
    const now = 1_700_000_000_000;
    const token = await generateUnsubscribeToken({
      profileId: PROFILE_A,
      ttlSeconds: 60,
      nowMs: now,
    });
    const verified = await verifyUnsubscribeToken(token, { nowMs: now });
    expect(verified?.expiresAt).toBe(Math.floor(now / 1000) + 60);
  });
});

describe("verifyUnsubscribeToken — tamper rejection", () => {
  it("rejects a token whose payload byte was flipped", async () => {
    const token = await generateUnsubscribeToken({ profileId: PROFILE_A });
    const dot = token.indexOf(".");
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    // Mutate the payload's first character to a different valid base64url char.
    const swap = payload[0] === "A" ? "B" : "A";
    const tampered = swap + payload.slice(1) + "." + sig;
    expect(await verifyUnsubscribeToken(tampered)).toBeNull();
  });

  it("rejects a token whose signature byte was flipped", async () => {
    const token = await generateUnsubscribeToken({ profileId: PROFILE_A });
    const dot = token.indexOf(".");
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const swap = sig[sig.length - 1] === "A" ? "B" : "A";
    const tampered = payload + "." + sig.slice(0, -1) + swap;
    expect(await verifyUnsubscribeToken(tampered)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await generateUnsubscribeToken({ profileId: PROFILE_A });
    const original = process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET;
    try {
      process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET = "deadbeef".repeat(8);
      expect(await verifyUnsubscribeToken(token)).toBeNull();
    } finally {
      process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET = original;
    }
  });
});

describe("verifyUnsubscribeToken — expiry", () => {
  it("returns null when the token is past its expiry", async () => {
    const issuedAt = 1_700_000_000_000;
    const token = await generateUnsubscribeToken({
      profileId: PROFILE_A,
      ttlSeconds: 10,
      nowMs: issuedAt,
    });
    // Verify 30 seconds later — past the 10s TTL.
    const verified = await verifyUnsubscribeToken(token, {
      nowMs: issuedAt + 30_000,
    });
    expect(verified).toBeNull();
  });

  it("returns the payload when verified within the TTL window", async () => {
    const issuedAt = 1_700_000_000_000;
    const token = await generateUnsubscribeToken({
      profileId: PROFILE_A,
      ttlSeconds: 60,
      nowMs: issuedAt,
    });
    const verified = await verifyUnsubscribeToken(token, {
      nowMs: issuedAt + 30_000,
    });
    expect(verified).not.toBeNull();
  });
});

describe("verifyUnsubscribeToken — malformed input", () => {
  it.each([
    ["empty string", ""],
    ["no dot separator", "abc"],
    ["leading dot", ".abc"],
    ["trailing dot", "abc."],
    ["non-base64url characters", "!!!.???"],
    ["unicode garbage", "❌.❌"],
  ])("rejects %s", async (_label, malformed) => {
    expect(await verifyUnsubscribeToken(malformed)).toBeNull();
  });
});

describe("buildUnsubscribeUrl", () => {
  it("appends the token as the `t` query param", async () => {
    const token = await generateUnsubscribeToken({ profileId: PROFILE_A });
    const url = buildUnsubscribeUrl({
      baseUrl: "https://app.handibowls.app",
      token,
    });
    expect(url.startsWith("https://app.handibowls.app/email/unsubscribe?t=")).toBe(
      true,
    );
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/email/unsubscribe");
    expect(parsed.searchParams.get("t")).toBe(token);
  });
});
