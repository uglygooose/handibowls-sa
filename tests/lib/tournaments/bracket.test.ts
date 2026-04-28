import { describe, expect, it } from "vitest";
import { finishPlacementLabel, largestPowerOfTwoLE, roundLabel } from "@/lib/tournaments/bracket";

describe("largestPowerOfTwoLE", () => {
  it("returns self for exact powers", () => {
    expect(largestPowerOfTwoLE(1)).toBe(1);
    expect(largestPowerOfTwoLE(2)).toBe(2);
    expect(largestPowerOfTwoLE(4)).toBe(4);
    expect(largestPowerOfTwoLE(16)).toBe(16);
  });
  it("rounds down for non-powers", () => {
    expect(largestPowerOfTwoLE(5)).toBe(4);
    expect(largestPowerOfTwoLE(7)).toBe(4);
    expect(largestPowerOfTwoLE(9)).toBe(8);
    expect(largestPowerOfTwoLE(20)).toBe(16);
  });
  it("returns 0 for n < 1", () => {
    expect(largestPowerOfTwoLE(0)).toBe(0);
    expect(largestPowerOfTwoLE(-3)).toBe(0);
  });
});

describe("roundLabel", () => {
  it("returns 'Round -' for zero round", () => {
    expect(roundLabel({ totalTeams: 8, roundNo: 0 })).toBe("Round -");
    expect(roundLabel({ totalTeams: 8, roundNo: null })).toBe("Round -");
  });
  it("falls back when totalTeams < 2", () => {
    expect(roundLabel({ totalTeams: 1, roundNo: 1 })).toBe("Round 1");
    expect(roundLabel({ totalTeams: 0, roundNo: 2 })).toBe("Round 2");
  });
  it("16-team bracket produces Quarters / Semis / Final", () => {
    expect(roundLabel({ totalTeams: 16, roundNo: 1 })).toBe(`RD 1`);
    expect(roundLabel({ totalTeams: 16, roundNo: 2 })).toBe("Quarters");
    expect(roundLabel({ totalTeams: 16, roundNo: 3 })).toBe("Semis");
    expect(roundLabel({ totalTeams: 16, roundNo: 4 })).toBe("Final");
  });
  it("8-team bracket starts at Quarters", () => {
    expect(roundLabel({ totalTeams: 8, roundNo: 1 })).toBe("Quarters");
    expect(roundLabel({ totalTeams: 8, roundNo: 2 })).toBe("Semis");
    expect(roundLabel({ totalTeams: 8, roundNo: 3 })).toBe("Final");
  });
  it("pre-round for non-power sizes", () => {
    // 5 teams → base 4, pre-round for round 1
    expect(roundLabel({ totalTeams: 5, roundNo: 1 })).toBe("Pre-Rd");
    expect(roundLabel({ totalTeams: 5, roundNo: 2 })).toBe("Semis");
  });
});

describe("finishPlacementLabel", () => {
  it("returns null when no round or no teams", () => {
    expect(finishPlacementLabel({ totalTeams: 8, roundNo: 0 })).toBe(null);
    expect(finishPlacementLabel({ totalTeams: 1, roundNo: 1 })).toBe(null);
  });
  it("16-team bracket placements", () => {
    expect(finishPlacementLabel({ totalTeams: 16, roundNo: 4 })).toBe("Runner-up");
    expect(finishPlacementLabel({ totalTeams: 16, roundNo: 3 })).toBe("Tied 3rd");
    expect(finishPlacementLabel({ totalTeams: 16, roundNo: 2 })).toBe("Tied 5-8");
    expect(finishPlacementLabel({ totalTeams: 16, roundNo: 1 })).toBe("Tied 9-16");
  });
});
