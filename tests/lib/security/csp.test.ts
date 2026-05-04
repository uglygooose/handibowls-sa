import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildContentSecurityPolicy,
  buildReportingEndpoints,
  generateNonce,
  resolveSentryEndpoint,
  type SentryEndpoint,
} from "@/lib/security/csp";

const FIXTURE_SENTRY: SentryEndpoint = {
  host: "o123.ingest.sentry.io",
  projectId: "456",
  publicKey: "abc",
  reportUrl: "https://o123.ingest.sentry.io/api/456/security/?sentry_key=abc",
};

describe("generateNonce", () => {
  it("produces a non-empty base64 string", () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(nonce.length).toBeGreaterThan(0);
  });

  it("emits a unique nonce per call", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });
});

describe("resolveSentryEndpoint", () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_SENTRY_DSN;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = ORIGINAL;
  });

  it("falls back to hardcoded production values when DSN is unset", () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const endpoint = resolveSentryEndpoint();
    expect(endpoint.host).toBe("o4511319521558528.ingest.de.sentry.io");
    expect(endpoint.projectId).toBe("4511319531389008");
    expect(endpoint.reportUrl).toContain("/api/4511319531389008/security/");
  });

  it("parses host/projectId/publicKey from a valid DSN", () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://pubkey@o9.ingest.sentry.io/42";
    const endpoint = resolveSentryEndpoint();
    expect(endpoint.host).toBe("o9.ingest.sentry.io");
    expect(endpoint.projectId).toBe("42");
    expect(endpoint.publicKey).toBe("pubkey");
    expect(endpoint.reportUrl).toBe(
      "https://o9.ingest.sentry.io/api/42/security/?sentry_key=pubkey",
    );
  });

  it("falls back when DSN is malformed", () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "not-a-url";
    const endpoint = resolveSentryEndpoint();
    expect(endpoint.host).toBe("o4511319521558528.ingest.de.sentry.io");
  });

  it("falls back when DSN has no project id", () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://pubkey@o9.ingest.sentry.io/";
    const endpoint = resolveSentryEndpoint();
    expect(endpoint.host).toBe("o4511319521558528.ingest.de.sentry.io");
  });
});

describe("buildContentSecurityPolicy", () => {
  const ORIGINAL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
  });

  afterEach(() => {
    if (ORIGINAL_SUPABASE === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_SUPABASE;
  });

  it("embeds the nonce inside script-src", () => {
    const csp = buildContentSecurityPolicy({
      nonce: "TESTNONCE",
      sentry: FIXTURE_SENTRY,
      vercelEnv: "production",
      nodeEnv: "production",
    });
    expect(csp).toMatch(/script-src 'self' 'nonce-TESTNONCE'/);
  });

  it("includes Sentry host on connect-src + report-uri", () => {
    const csp = buildContentSecurityPolicy({
      nonce: "n",
      sentry: FIXTURE_SENTRY,
      vercelEnv: "production",
      nodeEnv: "production",
    });
    expect(csp).toContain("https://o123.ingest.sentry.io");
    expect(csp).toContain(`report-uri ${FIXTURE_SENTRY.reportUrl}`);
    expect(csp).toContain("report-to csp-endpoint");
  });

  it("includes Supabase host on connect-src (https + wss) + img-src", () => {
    const csp = buildContentSecurityPolicy({
      nonce: "n",
      sentry: FIXTURE_SENTRY,
      vercelEnv: "production",
      nodeEnv: "production",
    });
    expect(csp).toContain("https://demo.supabase.co");
    expect(csp).toContain("wss://demo.supabase.co");
  });

  it("falls back to wildcard supabase host when env var is unset", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const csp = buildContentSecurityPolicy({
      nonce: "n",
      sentry: FIXTURE_SENTRY,
      vercelEnv: "production",
      nodeEnv: "production",
    });
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("wss://*.supabase.co");
  });

  it("EXCLUDES https://vercel.live on production VERCEL_ENV", () => {
    const csp = buildContentSecurityPolicy({
      nonce: "n",
      sentry: FIXTURE_SENTRY,
      vercelEnv: "production",
      nodeEnv: "production",
    });
    expect(csp).not.toContain("https://vercel.live");
  });

  it.each(["preview", "development"])(
    "INCLUDES https://vercel.live on script-src + connect-src for VERCEL_ENV=%s",
    (vercelEnv) => {
      const csp = buildContentSecurityPolicy({
        nonce: "n",
        sentry: FIXTURE_SENTRY,
        vercelEnv,
        nodeEnv: "production",
      });
      // Two occurrences: one in script-src, one in connect-src.
      const matches = csp.match(/https:\/\/vercel\.live/g) ?? [];
      expect(matches.length).toBe(2);
    },
  );

  it("EXCLUDES https://vercel.live when VERCEL_ENV is undefined (local dev)", () => {
    const csp = buildContentSecurityPolicy({
      nonce: "n",
      sentry: FIXTURE_SENTRY,
      vercelEnv: undefined,
      nodeEnv: "development",
    });
    expect(csp).not.toContain("https://vercel.live");
  });

  it("appends 'unsafe-eval' to script-src only when NODE_ENV=development", () => {
    const dev = buildContentSecurityPolicy({
      nonce: "n",
      sentry: FIXTURE_SENTRY,
      vercelEnv: undefined,
      nodeEnv: "development",
    });
    expect(dev).toContain("'unsafe-eval'");

    const prod = buildContentSecurityPolicy({
      nonce: "n",
      sentry: FIXTURE_SENTRY,
      vercelEnv: "production",
      nodeEnv: "production",
    });
    expect(prod).not.toContain("'unsafe-eval'");
  });

  it("preserves the locked allow-list directives", () => {
    const csp = buildContentSecurityPolicy({
      nonce: "n",
      sentry: FIXTURE_SENTRY,
      vercelEnv: "production",
      nodeEnv: "production",
    });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe("buildReportingEndpoints", () => {
  it("emits the named csp-endpoint group pointing at Sentry", () => {
    expect(buildReportingEndpoints(FIXTURE_SENTRY)).toBe(
      `csp-endpoint="${FIXTURE_SENTRY.reportUrl}"`,
    );
  });
});

describe("integration: nonce → CSP shape", () => {
  it("ties a generated nonce into the CSP header verbatim", () => {
    const nonce = generateNonce();
    const csp = buildContentSecurityPolicy({
      nonce,
      sentry: FIXTURE_SENTRY,
      vercelEnv: "production",
      nodeEnv: "production",
    });
    expect(csp).toContain(`'nonce-${nonce}'`);
  });
});

// Sanity: no dangling vi side-effects across this file's globals.
afterEach(() => {
  vi.restoreAllMocks();
});
