import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  computeLadder,
  heroCopyFor,
} from "@/app/(player)/(gated)/t20/page";

// Phase 12 / 12-1 + 12-1 followup — pure-helper coverage for the
// player Twenty 20 hub.
//
// The page itself is a Server Component (no DOM-render harness needed
// — the surface's behaviour is all data → text rendering against the
// helpers exercised below). Helpers are pure: ladder state mapping and
// hero copy branching across the {null, fail, bronze, silver, gold}
// grade matrix.
//
// 12-1 followup removed the per-tier ctaCopyFor — the hero CTA is now
// a single tier-agnostic "Request assessment" button that posts to
// the requestT20Assessment server action regardless of current grade.
// The action itself targets the right club (latest-assessed club, or
// the player's primary). Subline copy still references "request" so
// the visual message stays coherent across the matrix.

describe("computeLadder", () => {
  it("renders every step as future when the player has no grade yet", () => {
    const ladder = computeLadder(null);
    expect(ladder).toHaveLength(4);
    expect(ladder.map((s) => s.tier)).toEqual([
      "bronze",
      "silver",
      "gold",
      "platinum",
    ]);
    expect(ladder.every((s) => s.state === "future")).toBe(true);
  });

  it("renders every step as future on a fail grade", () => {
    const ladder = computeLadder("fail");
    expect(ladder.every((s) => s.state === "future")).toBe(true);
  });

  it("renders bronze active and silver/gold/platinum future for a bronze player", () => {
    const ladder = computeLadder("bronze");
    expect(ladder.find((s) => s.tier === "bronze")?.state).toBe("active");
    expect(ladder.find((s) => s.tier === "silver")?.state).toBe("future");
    expect(ladder.find((s) => s.tier === "gold")?.state).toBe("future");
    expect(ladder.find((s) => s.tier === "platinum")?.state).toBe("future");
  });

  it("renders bronze done, silver active, gold/platinum future for a silver player", () => {
    const ladder = computeLadder("silver");
    expect(ladder.find((s) => s.tier === "bronze")?.state).toBe("done");
    expect(ladder.find((s) => s.tier === "silver")?.state).toBe("active");
    expect(ladder.find((s) => s.tier === "gold")?.state).toBe("future");
    expect(ladder.find((s) => s.tier === "platinum")?.state).toBe("future");
  });

  it("renders bronze + silver done, gold active, platinum future for a gold player", () => {
    const ladder = computeLadder("gold");
    expect(ladder.find((s) => s.tier === "bronze")?.state).toBe("done");
    expect(ladder.find((s) => s.tier === "silver")?.state).toBe("done");
    expect(ladder.find((s) => s.tier === "gold")?.state).toBe("active");
    // Platinum is aspirational — no enum value reaches it today
    // (DRIFT_LOG: Player /t20 ladder Platinum tier is aspirational).
    expect(ladder.find((s) => s.tier === "platinum")?.state).toBe("future");
  });
});

describe("heroCopyFor", () => {
  it("returns ungraded copy when latest is null", () => {
    const copy = heroCopyFor(null);
    expect(copy.gradeText).toBe("UNGRADED");
    expect(copy.subline).toMatch(/no assessment recorded/i);
    expect(copy.subline).toMatch(/request your first/i);
  });

  it("returns ungraded copy when latest.grade is null", () => {
    const copy = heroCopyFor({ grade: null, assessed_on: "2026-04-01" });
    expect(copy.gradeText).toBe("UNGRADED");
  });

  it("returns retry copy with last-assessed date when grade is fail", () => {
    const copy = heroCopyFor({ grade: "fail", assessed_on: "2026-02-12" });
    expect(copy.gradeText).toBe("RETRY");
    // Africa/Johannesburg en-ZA renders this as "12 Feb 2026".
    expect(copy.subline).toMatch(/12 Feb 2026/);
    expect(copy.subline).toMatch(/request a retry/i);
  });

  it("returns uppercase grade text + earned/valid copy on bronze", () => {
    const copy = heroCopyFor({ grade: "bronze", assessed_on: "2026-02-12" });
    expect(copy.gradeText).toBe("BRONZE");
    expect(copy.subline).toMatch(/earned 12 Feb 2026 · valid 12 mo/i);
  });

  it("returns uppercase grade text + earned/valid copy on silver", () => {
    const copy = heroCopyFor({ grade: "silver", assessed_on: "2026-02-12" });
    expect(copy.gradeText).toBe("SILVER");
    expect(copy.subline).toMatch(/earned/i);
  });

  it("returns uppercase grade text + earned/valid copy on gold", () => {
    const copy = heroCopyFor({ grade: "gold", assessed_on: "2026-02-12" });
    expect(copy.gradeText).toBe("GOLD");
  });
});
