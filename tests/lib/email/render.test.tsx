import { describe, expect, it } from "vitest";

import { renderEmail } from "@/lib/email/render";
import { BaseLayout } from "@/lib/email/templates/_BaseLayout";

// Phase 11 / 11-1 — render helper + base-layout shell smoke test.
//
// The template-specific snapshot tests live under `tests/email/`
// and pin the full HTML. This file asserts the bare contract:
//   • renderEmail returns both html and text variants.
//   • The base layout emits the kicker, the unsubscribe link, and
//     the sender attribution on every send (POPIA invariants).
// Catches any future regression that drops one of these.

describe("renderEmail", () => {
  it("returns both html and text representations", async () => {
    const result = await renderEmail(
      <BaseLayout
        themePreset="core-black"
        kicker="BASE LAYOUT TEST"
        baseUrl="https://app.handibowls.app"
        unsubscribeToken="test-token-payload.test-token-sig"
        senderName="HandiBowls"
      >
        <p>Hello body.</p>
      </BaseLayout>,
    );
    expect(typeof result.html).toBe("string");
    expect(typeof result.text).toBe("string");
    expect(result.html.length).toBeGreaterThan(0);
    expect(result.text.length).toBeGreaterThan(0);
  });
});

describe("BaseLayout — POPIA invariants", () => {
  async function renderShell(
    themePreset: "core-black" | "atomic-red" | null,
  ) {
    return renderEmail(
      <BaseLayout
        themePreset={themePreset}
        kicker="INVARIANT CHECK"
        baseUrl="https://app.handibowls.app"
        unsubscribeToken="test-token-payload.test-token-sig"
        clubAddress="Demo Bowls Club, 12 Speckle Lane, Cape Town"
        senderName="Demo Bowls Club"
      >
        <p>Body text.</p>
      </BaseLayout>,
    );
  }

  it("emits the kicker into the header strip", async () => {
    const { html } = await renderShell("core-black");
    expect(html).toContain("INVARIANT CHECK");
  });

  it("emits a clickable unsubscribe link with the supplied token", async () => {
    const { html } = await renderShell("core-black");
    expect(html).toContain(
      "https://app.handibowls.app/email/unsubscribe?t=test-token-payload.test-token-sig",
    );
    expect(html).toContain("unsubscribe from these emails");
  });

  it("emits the sender attribution and POPIA legal copy", async () => {
    const { html } = await renderShell("core-black");
    expect(html).toContain("Sent by Demo Bowls Club via HandiBowls.");
    expect(html).toContain("POPIA-compliant");
  });

  it("emits the optional club address line when provided", async () => {
    const { html } = await renderShell("core-black");
    expect(html).toContain("Demo Bowls Club, 12 Speckle Lane, Cape Town");
  });

  it("falls back to the core-black preset when themePreset is null", async () => {
    const { html } = await renderShell(null);
    // Core Black header colour is #0a0a0a.
    expect(html.toLowerCase()).toContain("background-color:#0a0a0a");
  });

  it("renders the atomic-red primary in the header strip when themed", async () => {
    const { html } = await renderShell("atomic-red");
    expect(html.toLowerCase()).toContain("background-color:#d7261e");
  });
});
