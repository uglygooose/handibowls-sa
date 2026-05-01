import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { QuickActions } from "@/app/(player)/(gated)/play/_components/QuickActions";

// Phase 12.5 / 12.5-4 amendment Stage 2 — pin the My Twenty 20
// QuickAction caption + badge contract:
//
//   • Player has zero submitted assessments → meta line reads
//     "Not yet assessed", no GradePill rendered anywhere on the
//     card.
//   • Player has at least one submitted assessment → meta line
//     reads the date in en-ZA upper case (e.g. "30 APR 2026"),
//     and the GradePill renders inside the card's `topRight`
//     slot in the top row (alongside the icon, NOT in the meta
//     line). This matches the `<RecentResults>` precedent on the
//     same /play surface (`RecentResults.tsx:45` — top-row
//     `flex justify-between` with title-left + outcome-pill-right).
//
// Pre-Stage-2 the pill rendered inline in the meta line —
// regression-pinned here so the placement convention can't
// silently drift back.

afterEach(cleanup);

describe("<QuickActions /> — My Twenty 20 caption + badge placement (12.5-4 amendment Stage 2)", () => {
  it("renders 'Not yet assessed' meta + no pill anywhere when t20Latest is null", () => {
    const { container } = render(
      <QuickActions counts={{ openTournaments: null, t20Latest: null }} />,
    );
    const meta = container.querySelector(
      "[data-slot='t20-meta'][data-state='never-assessed']",
    );
    expect(meta).not.toBeNull();
    expect(meta?.textContent?.toLowerCase()).toContain("not yet assessed");
    // Contract: zero pills on the entire QuickActions row when
    // never-assessed.
    expect(container.querySelector("[data-slot='grade-pill']")).toBeNull();
    // Contract: top-right slot not rendered (no pill to host).
    expect(container.querySelector("[data-slot='quick-action-top-right']")).toBeNull();
  });

  it("places the gold pill in the top-right slot (not the meta line) when grade is gold", () => {
    const { container } = render(
      <QuickActions
        counts={{
          openTournaments: null,
          t20Latest: { grade: "gold", assessed_on: "2026-04-30" },
        }}
      />,
    );

    // Pill exists exactly once and lives inside `quick-action-top-right`,
    // which itself is inside `quick-action-top` (the icon row).
    const pills = container.querySelectorAll("[data-slot='grade-pill']");
    expect(pills).toHaveLength(1);
    const pill = pills[0];
    expect(pill.getAttribute("data-grade")).toBe("gold");
    expect(pill.getAttribute("data-size")).toBe("sm");

    const topRightSlot = pill.closest("[data-slot='quick-action-top-right']");
    expect(topRightSlot).not.toBeNull();
    const topRow = topRightSlot?.closest("[data-slot='quick-action-top']");
    expect(topRow).not.toBeNull();

    // Meta line carries the date (no pill inside it).
    const meta = container.querySelector(
      "[data-slot='t20-meta'][data-state='assessed']",
    );
    expect(meta).not.toBeNull();
    expect(meta?.textContent).toMatch(/30 APR 2026/);
    expect(meta?.querySelector("[data-slot='grade-pill']")).toBeNull();
  });

  it("places the 'Reassess' pill in the top-right slot when grade is fail", () => {
    const { container } = render(
      <QuickActions
        counts={{
          openTournaments: null,
          t20Latest: { grade: "fail", assessed_on: "2026-04-30" },
        }}
      />,
    );
    const pill = container.querySelector(
      "[data-slot='grade-pill'][data-grade='fail']",
    );
    expect(pill).not.toBeNull();
    expect(pill?.textContent).toMatch(/reassess/i);
    expect(pill?.closest("[data-slot='quick-action-top-right']")).not.toBeNull();
  });

  it("renders date alone (no pill, no top-right slot) when grade is null on the latest row", () => {
    const { container } = render(
      <QuickActions
        counts={{
          openTournaments: null,
          t20Latest: { grade: null, assessed_on: "2026-04-30" },
        }}
      />,
    );
    const meta = container.querySelector(
      "[data-slot='t20-meta'][data-state='assessed']",
    );
    expect(meta).not.toBeNull();
    expect(meta?.textContent).toMatch(/30 APR 2026/);
    expect(container.querySelector("[data-slot='grade-pill']")).toBeNull();
    expect(container.querySelector("[data-slot='quick-action-top-right']")).toBeNull();
  });

  it("My Twenty 20 card links to /t20", () => {
    const { container } = render(
      <QuickActions
        counts={{
          openTournaments: null,
          t20Latest: { grade: "silver", assessed_on: "2026-04-30" },
        }}
      />,
    );
    const links = Array.from(container.querySelectorAll("a"));
    const t20Link = links.find((a) => a.getAttribute("href") === "/t20");
    expect(t20Link).toBeTruthy();
  });

  it("non-t20 cards do NOT render a top-right slot (other QuickActions stay icon-only at top)", () => {
    const { container } = render(
      <QuickActions
        counts={{
          openTournaments: 3,
          t20Latest: { grade: "gold", assessed_on: "2026-04-30" },
        }}
      />,
    );
    // Only one top-right slot across all 3 cards (the t20 one).
    const topRights = container.querySelectorAll(
      "[data-slot='quick-action-top-right']",
    );
    expect(topRights).toHaveLength(1);
    // Top-right slot is inside the link to /t20, not /tournaments
    // or /book.
    const link = topRights[0].closest("a");
    expect(link?.getAttribute("href")).toBe("/t20");
  });
});
