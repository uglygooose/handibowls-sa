import { describe, expect, it } from "vitest";
import { shortName, singlesHandicapInfo, singlesHandicapLine } from "./handicap";

describe("shortName", () => {
  it("returns first word", () => {
    expect(shortName("John Smith")).toBe("John");
    expect(shortName("  Jane  Doe ")).toBe("Jane");
  });
  it("handles empty/null", () => {
    expect(shortName(null)).toBe("");
    expect(shortName("")).toBe("");
    expect(shortName("   ")).toBe("");
  });
});

function baseInput(overrides: Partial<Parameters<typeof singlesHandicapInfo>[0]> = {}) {
  return {
    format: "SINGLES" as string | null | undefined,
    teamAId: "A",
    teamBId: "B",
    teamMembersByTeamId: { A: ["p1"], B: ["p2"] },
    handicapByPlayerId: { p1: 8, p2: 12 },
    nameByPlayerId: { p1: "Alice Stone", p2: "Bob Jones" },
    ...overrides,
  };
}

describe("singlesHandicapInfo", () => {
  it("returns null for non-SINGLES", () => {
    expect(singlesHandicapInfo(baseInput({ format: "DOUBLES" }))).toBe(null);
  });
  it("returns null when a team id is missing", () => {
    expect(singlesHandicapInfo(baseInput({ teamAId: null }))).toBe(null);
  });
  it("computes diff + plusTo=A when A has lower handicap", () => {
    const hc = singlesHandicapInfo(baseInput());
    expect(hc).not.toBeNull();
    expect(hc!.diff).toBe(4);
    expect(hc!.plusTo).toBe("A");
  });
  it("plusTo=B when B has lower handicap", () => {
    const hc = singlesHandicapInfo(baseInput({ handicapByPlayerId: { p1: 15, p2: 9 } }));
    expect(hc!.plusTo).toBe("B");
  });
  it("level when diff is 0", () => {
    const hc = singlesHandicapInfo(baseInput({ handicapByPlayerId: { p1: 10, p2: 10 } }));
    expect(hc!.diff).toBe(0);
    expect(hc!.plusTo).toBe(null);
  });
  it("returns diff=null when either handicap is missing", () => {
    const hc = singlesHandicapInfo(baseInput({ handicapByPlayerId: { p1: 10, p2: null } }));
    expect(hc!.diff).toBe(null);
  });
});

describe("singlesHandicapLine", () => {
  it("returns null for SCRATCH rule", () => {
    expect(singlesHandicapLine(baseInput(), "SCRATCH")).toBe(null);
  });
  it("returns '+N to <name>' when there's a diff", () => {
    expect(singlesHandicapLine(baseInput(), "HANDICAP_START")).toBe("Handicap: +4 to Alice");
  });
  it("returns 'Handicap: level' at level", () => {
    expect(
      singlesHandicapLine(baseInput({ handicapByPlayerId: { p1: 10, p2: 10 } }), "HANDICAP_START")
    ).toBe("Handicap: level");
  });
  it("returns 'Handicap: -' when handicap missing", () => {
    expect(
      singlesHandicapLine(baseInput({ handicapByPlayerId: { p1: 10, p2: null } }), "HANDICAP_START")
    ).toBe("Handicap: -");
  });
});
