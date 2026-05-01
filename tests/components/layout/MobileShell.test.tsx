import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { MobileShell } from "@/components/layout/MobileShell";

// Phase 12.5 / 12.5-6 (J / `player-bottom-padding`) — pin the
// MobileShell main container's bottom padding. Long lists on
// /me/inbox / /tournaments / /book previously clipped behind the
// iOS Safari home indicator on notched devices because the shell
// only padded for the static 76-80px bottom nav (`pb-20`). The
// runtime-aware `pb-[calc(env(safe-area-inset-bottom)+80px)]`
// adds the safe-area inset on top so the breathing gap survives.

afterEach(cleanup);

describe("<MobileShell />", () => {
  it("renders the main scroll container with the safe-area-inset bottom padding", () => {
    const { container } = render(
      <MobileShell header={<div>top</div>} nav={<div>nav</div>}>
        <p>body</p>
      </MobileShell>,
    );
    const main = container.querySelector("[data-slot='mobile-shell-main']");
    expect(main?.tagName).toBe("MAIN");
    const cls = main?.className ?? "";
    // Padding accounts for env(safe-area-inset-bottom) AND the 80px
    // bottom-nav allowance. Drift back to a static `pb-20` would
    // re-introduce the iOS clipping bug.
    expect(cls).toContain("pb-[calc(env(safe-area-inset-bottom)+80px)]");
    expect(cls).not.toMatch(/\bpb-20\b/);
  });

  it("flex-1 on main so the body fills the viewport between header and nav", () => {
    const { container } = render(<MobileShell>body</MobileShell>);
    const main = container.querySelector("[data-slot='mobile-shell-main']");
    expect(main?.className).toContain("flex-1");
  });

  it("renders header before main, main before nav (DOM order — sticky header / fixed nav rely on it)", () => {
    const { container } = render(
      <MobileShell
        header={<header data-testid="hdr">top</header>}
        nav={<nav data-testid="bottom-nav">bottom</nav>}
      >
        <p data-testid="body">body</p>
      </MobileShell>,
    );
    const shell = container.querySelector("[data-slot='mobile-shell']");
    const children = Array.from(shell?.children ?? []);
    const matchById = (c: Element, id: string) =>
      c.matches(`[data-testid='${id}']`) ||
      c.querySelector(`[data-testid='${id}']`) !== null;
    const headerIdx = children.findIndex((c) => matchById(c, "hdr"));
    const mainIdx = children.findIndex((c) => c.getAttribute("data-slot") === "mobile-shell-main");
    const navIdx = children.findIndex((c) => matchById(c, "bottom-nav"));
    expect(headerIdx).toBeGreaterThanOrEqual(0);
    expect(navIdx).toBeGreaterThanOrEqual(0);
    expect(headerIdx).toBeLessThan(mainIdx);
    expect(mainIdx).toBeLessThan(navIdx);
  });
});
