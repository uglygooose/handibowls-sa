import { describe, expect, it } from "vitest";
import { shortName, singlesHandicapInfo, singlesHandicapLine } from "@/lib/tournaments/handicap";

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
    ruleType: "HANDICAP_START" as Parameters<typeof singlesHandicapInfo>[0]["ruleType"],
    teamAId: "A",
    teamBId: "B",
    teamMembersByTeamId: { A: ["p1"], B: ["p2"] },
    handicapByPlayerId: { p1: 8, p2: 12 },
    nameByPlayerId: { p1: "Alice Stone", p2: "Bob Jones" },
    ...overrides,
  };
}

describe("singlesHandicapInfo — handicap_rule gate", () => {
  it("returns null when ruleType is SCRATCH (gate at entry, no computation)", () => {
    expect(singlesHandicapInfo(baseInput({ ruleType: "SCRATCH" }))).toBe(null);
  });
  it("returns null when ruleType is null", () => {
    expect(singlesHandicapInfo(baseInput({ ruleType: null }))).toBe(null);
  });
  it("returns null when ruleType is undefined", () => {
    expect(singlesHandicapInfo(baseInput({ ruleType: undefined }))).toBe(null);
  });
  it("returns null for unknown rule values (defensive — only HANDICAP_START opts in)", () => {
    expect(singlesHandicapInfo(baseInput({ ruleType: "UNKNOWN_RULE" }))).toBe(null);
  });
  it("computes when ruleType is HANDICAP_START", () => {
    const hc = singlesHandicapInfo(baseInput({ ruleType: "HANDICAP_START" }));
    expect(hc).not.toBeNull();
    expect(hc!.diff).toBe(4);
  });
});

describe("singlesHandicapInfo — existing behaviour (rule HANDICAP_START)", () => {
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

describe("singlesHandicapLine — handicap_rule gate", () => {
  it("returns null when ruleType is SCRATCH", () => {
    expect(singlesHandicapLine(baseInput({ ruleType: "SCRATCH" }))).toBe(null);
  });
  it("returns null when ruleType is null", () => {
    expect(singlesHandicapLine(baseInput({ ruleType: null }))).toBe(null);
  });
  it("returns null when ruleType is undefined", () => {
    expect(singlesHandicapLine(baseInput({ ruleType: undefined }))).toBe(null);
  });
});

describe("singlesHandicapLine — existing behaviour (rule HANDICAP_START)", () => {
  it("returns '+N to <name>' when there's a diff", () => {
    expect(singlesHandicapLine(baseInput())).toBe("Handicap: +4 to Alice");
  });
  it("returns 'Handicap: level' at level", () => {
    expect(
      singlesHandicapLine(baseInput({ handicapByPlayerId: { p1: 10, p2: 10 } })),
    ).toBe("Handicap: level");
  });
  it("returns 'Handicap: -' when handicap missing", () => {
    expect(
      singlesHandicapLine(baseInput({ handicapByPlayerId: { p1: 10, p2: null } })),
    ).toBe("Handicap: -");
  });
});
