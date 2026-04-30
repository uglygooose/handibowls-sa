import "server-only";

// Phase 11 / 11-1 — POPIA-compliant HMAC unsubscribe tokens.
//
// Token format
//
//   <base64url(payload-json)>.<base64url(hmac-sha256-of-payload)>
//
//   payload-json: {"p":"<profileId>","c":"<clubId>"|null,"e":<unixSec>}
//
// Reasoning
//
//   • Web Crypto (`crypto.subtle`) — works in Edge runtime (where the
//     unsubscribe page may run) AND Node ≥19 / Bun. The Phase 11
//     plan keeps the unsubscribe surface public-no-auth so the link
//     in any Resend email is clickable from any inbox; we don't
//     want a Node-only crypto path that would force an opt-in to
//     `runtime = 'nodejs'` on the page.
//
//   • Self-contained payload — profileId + clubId + expiry are all
//     in the token. The verifier doesn't need a DB lookup to
//     authenticate the click; the HMAC IS the auth. (The opt-out
//     write itself, in `lib/email/actions.ts`, IS DB-backed.)
//
//   • 30-day expiry — long enough that an old reminder email's
//     unsubscribe link still works after a typical inbox-flush
//     cycle, short enough that a leaked token from a forwarded
//     email doesn't last indefinitely.
//
//   • Tamper / forgery — constant-time signature compare prevents
//     timing-side-channel attacks. The signing secret
//     (EMAIL_UNSUBSCRIBE_SIGNING_SECRET) lives only in the server
//     env and never touches client code.
//
// Out of scope
//
//   • Per-token revocation list — POPIA only requires the
//     "next send respects the opt-out", not "every previously-
//     issued unsubscribe link must be invalidated". A 30-day window
//     and a profile-level opt-out flag together satisfy the
//     requirement without standing up a token-revocation table.

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export type UnsubscribeTokenPayload = {
  profileId: string;
  clubId: string | null;
  /** Unix seconds. */
  expiresAt: number;
};

function getSigningKey(): string {
  const k = process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET;
  if (!k) {
    throw new Error("EMAIL_UNSUBSCRIBE_SIGNING_SECRET is not set");
  }
  return k;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  let raw: string;
  try {
    raw = atob(b64);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function importHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    ENCODER.encode(getSigningKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payloadBytes: Uint8Array): Promise<Uint8Array> {
  const key = await importHmacKey();
  // Cast: crypto.subtle wants `BufferSource` (ArrayBuffer-backed). Our
  // Uint8Array is typed `Uint8Array<ArrayBufferLike>` under TS 5.7+
  // strict-lib settings, which doesn't structurally match. Runtime is
  // identical — `subtle.sign` only reads the bytes.
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    payloadBytes as unknown as BufferSource,
  );
  return new Uint8Array(sig);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export type GenerateTokenInput = {
  profileId: string;
  clubId?: string | null;
  /** Override the default 30-day TTL (in seconds). Tests pass small
   *  values to exercise the expiry branch. */
  ttlSeconds?: number;
  /** Override `Date.now()` for deterministic snapshot tests. */
  nowMs?: number;
};

export async function generateUnsubscribeToken(
  input: GenerateTokenInput,
): Promise<string> {
  const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const expiresAt = nowSec + (input.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const json = JSON.stringify({
    p: input.profileId,
    c: input.clubId ?? null,
    e: expiresAt,
  });
  const payloadBytes = ENCODER.encode(json);
  const sigBytes = await sign(payloadBytes);
  return `${base64UrlEncode(payloadBytes)}.${base64UrlEncode(sigBytes)}`;
}

export type VerifyTokenOptions = {
  /** Override `Date.now()` for deterministic tests. */
  nowMs?: number;
};

export async function verifyUnsubscribeToken(
  token: string,
  options: VerifyTokenOptions = {},
): Promise<UnsubscribeTokenPayload | null> {
  if (typeof token !== "string" || token.length === 0) return null;
  const dot = token.indexOf(".");
  if (dot < 1 || dot >= token.length - 1) return null;

  const payloadBytes = base64UrlDecode(token.slice(0, dot));
  const sigBytes = base64UrlDecode(token.slice(dot + 1));
  if (!payloadBytes || !sigBytes) return null;

  const expected = await sign(payloadBytes);
  if (!constantTimeEqual(expected, sigBytes)) return null;

  let parsed: { p?: unknown; c?: unknown; e?: unknown };
  try {
    parsed = JSON.parse(DECODER.decode(payloadBytes));
  } catch {
    return null;
  }

  if (typeof parsed.p !== "string" || parsed.p.length === 0) return null;
  if (parsed.c !== null && typeof parsed.c !== "string") return null;
  if (typeof parsed.e !== "number" || !Number.isFinite(parsed.e)) return null;

  const nowSec = Math.floor((options.nowMs ?? Date.now()) / 1000);
  if (parsed.e < nowSec) return null;

  return {
    profileId: parsed.p,
    clubId: parsed.c,
    expiresAt: parsed.e,
  };
}

export function buildUnsubscribeUrl(args: {
  /** Origin only — e.g. `https://app.handibowls.app`. The path is
   *  appended internally so callers can't drift the route. */
  baseUrl: string;
  token: string;
}): string {
  const u = new URL("/email/unsubscribe", args.baseUrl);
  u.searchParams.set("t", args.token);
  return u.toString();
}
