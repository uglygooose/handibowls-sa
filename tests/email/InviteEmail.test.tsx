import { describe, expect, it } from "vitest";

import { renderEmail } from "@/lib/email/render";
import { InviteEmail, type InviteEmailProps } from "@/lib/email/templates/InviteEmail";

// Phase 11 / 11-1b — InviteEmail snapshot + content contract.
//
// Two layers of assertion:
//   1. Content contract — explicit `toContain` checks against the
//      strings users see (greeting, club name, accept URL, expiry,
//      POPIA footer). These survive cosmetic refactors of inline
//      styles or layout.
//   2. Full HTML snapshot — pinned via `toMatchFileSnapshot` so any
//      drift in markup or theme handling shows up as a reviewable
//      diff. The snapshot lives at
//      tests/email/__snapshots__/InviteEmail.html per the user's
//      brief.
//
// All test inputs are deterministic (fixed strings, fixed token);
// the speckle SVG inside BaseLayout is also pinned to fixed
// coordinates. Re-running the suite must produce zero diff.

const SAMPLE: InviteEmailProps = {
  recipientName: "James Thomas",
  clubName: "Demo Bowls Club",
  invitedBy: "Andrew Els",
  acceptUrl: "https://app.handibowls.app/invite/abc123def456",
  expiresOn: "14 May 2026",
  themePreset: "atomic-red",
  baseUrl: "https://app.handibowls.app",
  unsubscribeToken: "fixed-token-payload.fixed-token-sig",
  clubAddress: "Demo Bowls Club, 12 Speckle Lane, Cape Town",
};

describe("InviteEmail — content contract", () => {
  it("emits the recipient name in the greeting", async () => {
    const { html } = await renderEmail(<InviteEmail {...SAMPLE} />);
    expect(html).toContain("Hi James Thomas,");
  });

  it("emits the inviter name and club name in the intro line", async () => {
    const { html } = await renderEmail(<InviteEmail {...SAMPLE} />);
    expect(html).toContain(
      "Andrew Els has invited you to join Demo Bowls Club on HandiBowls.",
    );
  });

  it("emits the accept URL on the CTA button", async () => {
    const { html } = await renderEmail(<InviteEmail {...SAMPLE} />);
    expect(html).toContain('href="https://app.handibowls.app/invite/abc123def456"');
    expect(html).toContain("Accept invite");
  });

  it("emits the expiry date in the body", async () => {
    const { html } = await renderEmail(<InviteEmail {...SAMPLE} />);
    expect(html).toContain("14 May 2026");
    expect(html).toContain("14 days");
  });

  it("emits the unsubscribe link with the supplied token in the footer", async () => {
    const { html } = await renderEmail(<InviteEmail {...SAMPLE} />);
    expect(html).toContain(
      "https://app.handibowls.app/email/unsubscribe?t=fixed-token-payload.fixed-token-sig",
    );
    expect(html).toContain("unsubscribe from these emails");
  });

  it("emits the POPIA sender attribution and club address", async () => {
    const { html } = await renderEmail(<InviteEmail {...SAMPLE} />);
    expect(html).toContain("Sent by Demo Bowls Club via HandiBowls.");
    expect(html).toContain("Demo Bowls Club, 12 Speckle Lane, Cape Town");
    expect(html).toContain("POPIA-compliant");
  });

  it("uses the atomic-red preset's primary in the header strip", async () => {
    const { html } = await renderEmail(<InviteEmail {...SAMPLE} />);
    expect(html.toLowerCase()).toContain("background-color:#d7261e");
  });

  it("falls back to 'there' when recipientName is null", async () => {
    const { html } = await renderEmail(
      <InviteEmail {...SAMPLE} recipientName={null} />,
    );
    expect(html).toContain("Hi there,");
  });

  it("falls back to 'the club admin' when invitedBy is null", async () => {
    const { html } = await renderEmail(
      <InviteEmail {...SAMPLE} invitedBy={null} />,
    );
    expect(html).toContain(
      "the club admin has invited you to join Demo Bowls Club on HandiBowls.",
    );
  });

  it("falls back to core-black header colour when themePreset is null", async () => {
    const { html } = await renderEmail(
      <InviteEmail {...SAMPLE} themePreset={null} />,
    );
    expect(html.toLowerCase()).toContain("background-color:#0a0a0a");
  });

  it("uses 'Twenty 20' in the body copy (not 'T20')", async () => {
    // bsa-terminology canonical spelling lock — user-visible strings
    // must say Twenty 20 with a space.
    const { html } = await renderEmail(<InviteEmail {...SAMPLE} />);
    expect(html).toContain("Twenty 20");
    expect(html).not.toMatch(/\bT20\b/);
  });
});

describe("InviteEmail — full HTML snapshot", () => {
  it("matches the pinned golden HTML", async () => {
    const { html } = await renderEmail(<InviteEmail {...SAMPLE} />);
    await expect(html).toMatchFileSnapshot(
      "./__snapshots__/InviteEmail.html",
    );
  });

  it("plain-text fallback contains the same key strings", async () => {
    const { text } = await renderEmail(<InviteEmail {...SAMPLE} />);
    expect(text).toContain("Demo Bowls Club");
    expect(text).toContain("https://app.handibowls.app/invite/abc123def456");
    expect(text).toContain("14 May 2026");
    expect(text).toContain("unsubscribe");
  });
});
