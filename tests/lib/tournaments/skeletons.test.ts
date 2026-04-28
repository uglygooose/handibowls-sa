import { describe, expect, it } from "vitest";

import { generateRoundRobinFixtures } from "@/lib/tournaments/brackets/roundRobin";
import { generateSectionalFixtures } from "@/lib/tournaments/brackets/sectional";
import type { SeedingResult } from "@/lib/tournaments/seeding";

const SEEDING_FIXTURE: SeedingResult = {
  ordered: [
    { id: "t1", seed: 1, section_label: "A" },
    { id: "t2", seed: 2, section_label: "A" },
    { id: "t3", seed: 3, section_label: "B" },
    { id: "t4", seed: 4, section_label: "B" },
  ],
  pairings: null,
};

// Verbatim throw-message assertions per the 6c directive — future
// implementers grep for these strings to find the upgrade point.

describe("generateRoundRobinFixtures (skeleton)", () => {
  it("throws with the exact phase-12 cross-cutting callout", () => {
    expect(() => generateRoundRobinFixtures(SEEDING_FIXTURE)).toThrow(
      "Not implemented (Phase 12 cross-cutting)",
    );
  });
  it("throws even when given the empty seeding result (no early-success path)", () => {
    expect(() =>
      generateRoundRobinFixtures({ ordered: [], pairings: null }),
    ).toThrow("Not implemented (Phase 12 cross-cutting)");
  });
});

describe("generateSectionalFixtures (skeleton)", () => {
  it("throws with the exact phase-12-or-later callout", () => {
    expect(() => generateSectionalFixtures(SEEDING_FIXTURE)).toThrow(
      "Not implemented (Phase 12 or later)",
    );
  });
  it("throws even when given the empty seeding result", () => {
    expect(() =>
      generateSectionalFixtures({ ordered: [], pairings: null }),
    ).toThrow("Not implemented (Phase 12 or later)");
  });
});
