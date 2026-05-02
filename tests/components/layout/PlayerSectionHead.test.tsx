import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { PlayerSectionHead } from "@/components/layout/PlayerSectionHead";

// Phase 12.5 / 12.5-6.5 Stage C — pin the bundle contract from
// `.section-head` + `.section-head h3` + `.section-head a` rules
// in player-styles.css:297-302.

afterEach(cleanup);

describe("<PlayerSectionHead /> — bundle CSS contract", () => {
  it("renders h3 by default at text-[22px] font-display font-black italic uppercase (per .section-head h3)", () => {
    const { container } = render(
      <PlayerSectionHead>Recent results</PlayerSectionHead>,
    );
    const heading = container.querySelector(
      "[data-slot='player-section-head-title']",
    );
    expect(heading?.tagName).toBe("H3");
    expect(heading?.textContent).toBe("Recent results");
    const cls = heading?.className ?? "";
    expect(cls).toContain("text-[22px]");
    expect(cls).toContain("font-display");
    expect(cls).toContain("font-black");
    expect(cls).toContain("italic");
    expect(cls).toContain("uppercase");
  });

  it("supports as='h2' for sections that outrank a sibling — visual size stays at 22px", () => {
    const { container } = render(
      <PlayerSectionHead as="h2">Inbox</PlayerSectionHead>,
    );
    const heading = container.querySelector(
      "[data-slot='player-section-head-title']",
    );
    expect(heading?.tagName).toBe("H2");
    expect(heading?.className).toContain("text-[22px]");
  });

  it("wrapper has flex items-baseline justify-between gap-3 + 22px top / 10px bottom margin (per .section-head)", () => {
    const { container } = render(
      <PlayerSectionHead>Test</PlayerSectionHead>,
    );
    const wrap = container.querySelector("[data-slot='player-section-head']");
    const cls = wrap?.className ?? "";
    expect(cls).toContain("flex");
    expect(cls).toContain("items-baseline");
    expect(cls).toContain("justify-between");
    // Bundle: `margin: 22px 0 10px;`
    expect(cls).toContain("mt-[22px]");
    expect(cls).toContain("mb-[10px]");
  });
});

describe("<PlayerSectionHead /> — action + caption slots", () => {
  it("does NOT render an action or caption when neither prop given", () => {
    const { container } = render(
      <PlayerSectionHead>Test</PlayerSectionHead>,
    );
    expect(
      container.querySelector("[data-slot='player-section-head-action']"),
    ).toBeNull();
    expect(
      container.querySelector("[data-slot='player-section-head-caption']"),
    ).toBeNull();
  });

  it("renders Link action when href provided — mono 11px primary-500 uppercase per bundle .section-head a", () => {
    const { container } = render(
      <PlayerSectionHead action={{ label: "View all", href: "/me" }}>
        Recent results
      </PlayerSectionHead>,
    );
    const link = container.querySelector(
      "[data-slot='player-section-head-action']",
    );
    expect(link?.tagName).toBe("A");
    expect(link?.getAttribute("href")).toBe("/me");
    expect(link?.textContent).toBe("View all");
    const cls = link?.className ?? "";
    expect(cls).toContain("font-mono");
    expect(cls).toContain("text-[11px]");
    // Phase 13 / 13-1 / Tier A — text-primary-500 → text-accent-ink to fall back
    // to ink on sunburst + white-speckle presets where primary-500 fails AA on bone.
    expect(cls).toContain("text-accent-ink");
    expect(cls).toContain("uppercase");
    expect(cls).toContain("tracking-[0.06em]");
  });

  it("renders button action when onClick provided (no href)", () => {
    const { container } = render(
      <PlayerSectionHead action={{ label: "Refresh", onClick: () => {} }}>
        Test
      </PlayerSectionHead>,
    );
    const action = container.querySelector(
      "[data-slot='player-section-head-action']",
    );
    expect(action?.tagName).toBe("BUTTON");
  });

  it("renders caption (instead of action) for non-navigable status text — mono 11px ink-muted", () => {
    const { container } = render(
      <PlayerSectionHead caption="3 OPEN">Available slots</PlayerSectionHead>,
    );
    const caption = container.querySelector(
      "[data-slot='player-section-head-caption']",
    );
    expect(caption?.textContent).toBe("3 OPEN");
    const cls = caption?.className ?? "";
    expect(cls).toContain("font-mono");
    expect(cls).toContain("text-[11px]");
    expect(cls).toContain("text-ink-muted");
    // No action rendered when caption provided.
    expect(
      container.querySelector("[data-slot='player-section-head-action']"),
    ).toBeNull();
  });
});
