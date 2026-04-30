import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  computeLadder,
  ctaCopyFor,
  heroCopyFor,
} from "@/app/(player)/(gated)/t20/page";

// Phase 12 / 12-1 — pure-helper coverage for the player Twenty 20 hub.
//
// The page itself is a Server Component (no DOM-render harness needed
// — the surface's behaviour is all data → text rendering against the
// helpers exercised below). Helpers are pure: ladder state mapping,
// hero copy branching across the {null, fail, bronze, silver, gold}
// grade matrix, and CTA copy for the next-tier-up booking pattern.

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
    expect(copy.subline).toMatch(/book a retry/i);
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

describe("ctaCopyFor", () => {
  it("offers a first assessment when no grade exists yet", () => {
    expect(ctaCopyFor(null)).toMatch(/book first assessment/i);
  });

  it("offers a retry when the latest grade is fail", () => {
    expect(ctaCopyFor("fail")).toMatch(/book retry assessment/i);
  });

  it("offers the next tier up: bronze → silver", () => {
    expect(ctaCopyFor("bronze")).toMatch(/book silver assessment/i);
  });

  it("offers the next tier up: silver → gold", () => {
    expect(ctaCopyFor("silver")).toMatch(/book gold assessment/i);
  });

  it("offers the aspirational platinum CTA at gold", () => {
    expect(ctaCopyFor("gold")).toMatch(/book platinum assessment/i);
  });
});
