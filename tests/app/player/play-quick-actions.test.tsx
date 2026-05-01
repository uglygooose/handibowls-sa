import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { QuickActions } from "@/app/(player)/(gated)/play/_components/QuickActions";

// Phase 12.5 / 12.5-4 amendment (Finding 1) — pin the My Twenty 20
// QuickAction caption matrix:
//
//   • Player has zero submitted assessments → caption reads
//     "Not yet assessed" (muted tone, no pill).
//   • Player has at least one submitted assessment → caption reads
//     date in en-ZA upper-case (e.g. "30 APR 2026") + small
//     <GradePill> at sm size (gold / silver / bronze / Reassess).
//
// Pre-12.5-4-amendment the caption was hardcoded to
// "Not yet assessed" regardless of T20 state — pinned here so the
// regression cannot reappear silently.

afterEach(cleanup);

describe("<QuickActions /> — My Twenty 20 caption (12.5-4 amendment)", () => {
  it("renders 'Not yet assessed' when t20Latest is null", () => {
    const { container } = render(
      <QuickActions counts={{ openTournaments: null, t20Latest: null }} />,
    );
    const meta = container.querySelector(
      "[data-slot='t20-meta'][data-state='never-assessed']",
    );
    expect(meta).not.toBeNull();
    expect(meta?.textContent?.toLowerCase()).toContain("not yet assessed");
    // No GradePill rendered in the never-assessed state.
    expect(container.querySelector("[data-slot='grade-pill']")).toBeNull();
  });

  it("renders date + small gold pill when latest grade is gold", () => {
    const { container } = render(
      <QuickActions
        counts={{
          openTournaments: null,
          t20Latest: { grade: "gold", assessed_on: "2026-04-30" },
        }}
      />,
    );
    const meta = container.querySelector(
      "[data-slot='t20-meta'][data-state='assessed']",
    );
    expect(meta).not.toBeNull();
    // en-ZA renders 2026-04-30 as "30 Apr 2026"; we upper-case for
    // the all-caps mono caption.
    expect(meta?.textContent).toMatch(/30 APR 2026/);
    const pill = container.querySelector(
      "[data-slot='grade-pill'][data-grade='gold']",
    );
    expect(pill).not.toBeNull();
    expect(pill?.getAttribute("data-size")).toBe("sm");
  });

  it("renders date + 'Reassess' pill when latest grade is fail", () => {
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
  });

  it("renders date alone (no pill) when latest grade is null", () => {
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
});
