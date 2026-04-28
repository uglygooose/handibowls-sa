import { describe, expect, it } from "vitest";
import {
  computeBracketLines,
  computeTreeLayout,
  getMatchCardTone,
  singlesHandicapInfo,
  treeSlotLabel,
  type BracketMatchLike,
} from "@/lib/tournaments/brackets/matchHelpers";

const DIMS = {
  cardW: 200,
  cardH: 40,
  baseGap: 16,
  colGap: 100,
  headerOffset: 24,
};

const m = (over: Partial<BracketMatchLike> & { id: string }): BracketMatchLike => ({
  round_no: 1,
  team_a_id: null,
  team_b_id: null,
  ...over,
});

describe("computeTreeLayout", () => {
  it("empty rounds yields empty layouts and minimal width/height", () => {
    const out = computeTreeLayout([], DIMS);
    expect(out.roundLayouts).toEqual([]);
    expect(out.posById).toEqual({});
    expect(out.width).toBe(DIMS.cardW);
  });
  it("positions a 2-round tree with the right number of cards", () => {
    const out = computeTreeLayout(
      [
        { round: 1, matches: [m({ id: "a", match_no: 1 }), m({ id: "b", match_no: 2 })] },
        { round: 2, matches: [m({ id: "c", round_no: 2, match_no: 1 })] },
      ],
      DIMS,
    );
    expect(out.roundLayouts).toHaveLength(2);
    expect(Object.keys(out.posById)).toEqual(expect.arrayContaining(["a", "b", "c"]));
    expect(out.posById.c.x).toBe(DIMS.cardW + DIMS.colGap); // round 2 column
  });
  it("sorts matches by match_no within a round (id breakerlines tied)", () => {
    const out = computeTreeLayout(
      [{ round: 1, matches: [m({ id: "z", match_no: 2 }), m({ id: "a", match_no: 1 })] }],
      DIMS,
    );
    const round1 = out.roundLayouts[0].list;
    expect(round1.map((mm) => mm.id)).toEqual(["a", "z"]);
  });
});

describe("computeBracketLines", () => {
  it("emits no lines for round 0 (no parents)", () => {
    const layout = computeTreeLayout(
      [{ round: 1, matches: [m({ id: "a", match_no: 1 })] }],
      DIMS,
    );
    const positionsByRoundIndex = new Map(
      layout.roundPositions.map((r) => [r.roundIndex, r.matches]),
    );
    const lines = computeBracketLines(layout.roundLayouts, layout.posById, positionsByRoundIndex, DIMS.cardW);
    expect(lines).toEqual([]);
  });
  it("uses slot_*_source_match_id when present (explicit feeders)", () => {
    const layout = computeTreeLayout(
      [
        { round: 1, matches: [m({ id: "p1", match_no: 1 }), m({ id: "p2", match_no: 2 })] },
        {
          round: 2,
          matches: [
            m({
              id: "c",
              round_no: 2,
              match_no: 1,
              slot_a_source_match_id: "p1",
              slot_b_source_match_id: "p2",
            }),
          ],
        },
      ],
      DIMS,
    );
    const positionsByRoundIndex = new Map(
      layout.roundPositions.map((r) => [r.roundIndex, r.matches]),
    );
    const lines = computeBracketLines(layout.roundLayouts, layout.posById, positionsByRoundIndex, DIMS.cardW);
    expect(lines.length).toBe(2); // one per parent
    for (const d of lines) expect(d).toMatch(/^M /);
  });
  it("falls back to positional parents when source ids are missing", () => {
    const layout = computeTreeLayout(
      [
        { round: 1, matches: [m({ id: "p1", match_no: 1 }), m({ id: "p2", match_no: 2 })] },
        { round: 2, matches: [m({ id: "c", round_no: 2, match_no: 1 })] },
      ],
      DIMS,
    );
    const positionsByRoundIndex = new Map(
      layout.roundPositions.map((r) => [r.roundIndex, r.matches]),
    );
    const lines = computeBracketLines(layout.roundLayouts, layout.posById, positionsByRoundIndex, DIMS.cardW);
    expect(lines.length).toBe(2); // still emits two lines via fallback
  });
});

describe("treeSlotLabel", () => {
  const display = (teamId: string | null) => (teamId ? `Team ${teamId}` : "");
  const matchNoById = { feeder1: 7 };

  it("teamId set → returns the team display name", () => {
    expect(
      treeSlotLabel({ id: "x", round_no: 1, team_a_id: "t1", team_b_id: null }, "A", display, {}),
    ).toBe("Team t1");
  });
  it("BYE source → 'BYE'", () => {
    expect(
      treeSlotLabel(
        { id: "x", round_no: 1, team_a_id: null, team_b_id: null, slot_a_source_type: "BYE" },
        "A",
        display,
        {},
      ),
    ).toBe("BYE");
  });
  it("WINNER_OF_MATCH with known feeder → 'M<n> W'", () => {
    expect(
      treeSlotLabel(
        {
          id: "x",
          round_no: 2,
          team_a_id: null,
          team_b_id: null,
          slot_a_source_type: "WINNER_OF_MATCH",
          slot_a_source_match_id: "feeder1",
        },
        "A",
        display,
        matchNoById,
      ),
    ).toBe("M7 W");
  });
  it("WINNER_OF_MATCH without a known feeder match_no → 'Winner'", () => {
    expect(
      treeSlotLabel(
        {
          id: "x",
          round_no: 2,
          team_a_id: null,
          team_b_id: null,
          slot_a_source_type: "WINNER_OF_MATCH",
          slot_a_source_match_id: "unknown",
        },
        "A",
        display,
        {},
      ),
    ).toBe("Winner");
  });
  it("no team and no feeder → 'TBD'", () => {
    expect(
      treeSlotLabel({ id: "x", round_no: 2, team_a_id: null, team_b_id: null }, "A", display, {}),
    ).toBe("TBD");
  });
});

describe("getMatchCardTone", () => {
  it("complete tone for COMPLETED status", () => {
    expect(getMatchCardTone({ status: "COMPLETED" }).tone).toBe("complete");
  });
  it("complete tone for finalized_by_admin true", () => {
    expect(getMatchCardTone({ status: "OPEN", finalized_by_admin: true }).tone).toBe("complete");
  });
  it("complete tone when winner_team_id present", () => {
    expect(getMatchCardTone({ status: "OPEN", winner_team_id: "t1" }).tone).toBe("complete");
  });
  it("inplay tone for IN_PLAY status", () => {
    expect(getMatchCardTone({ status: "IN_PLAY" }).tone).toBe("inplay");
  });
  it("pending tone otherwise", () => {
    expect(getMatchCardTone({ status: "OPEN" }).tone).toBe("pending");
  });
});

describe("singlesHandicapInfo (matchHelpers variant)", () => {
  const teamDisplayName = (teamId: string | null) => (teamId ? `Team ${teamId}` : "");

  it("returns null for non-SINGLES format", () => {
    expect(
      singlesHandicapInfo({
        format: "PAIRS",
        teamAId: "tA",
        teamBId: "tB",
        teamMembersByTeamId: { tA: ["p1"], tB: ["p2"] },
        handicapByPlayerId: { p1: 8, p2: 12 },
        teamDisplayName,
      }),
    ).toBe(null);
  });
  it("computes diff when both handicaps present", () => {
    const hc = singlesHandicapInfo({
      format: "SINGLES",
      teamAId: "tA",
      teamBId: "tB",
      teamMembersByTeamId: { tA: ["p1"], tB: ["p2"] },
      handicapByPlayerId: { p1: 5, p2: 12 },
      teamDisplayName,
    });
    expect(hc!.diff).toBe(7);
    expect(hc!.plusTo).toBe("A");
  });
  it("returns nulls when handicaps missing", () => {
    const hc = singlesHandicapInfo({
      format: "SINGLES",
      teamAId: "tA",
      teamBId: "tB",
      teamMembersByTeamId: { tA: ["p1"], tB: ["p2"] },
      handicapByPlayerId: { p1: 5, p2: null },
      teamDisplayName,
    });
    expect(hc!.diff).toBe(null);
    expect(hc!.plusTo).toBe(null);
  });
  it("returns null when a team is missing members", () => {
    expect(
      singlesHandicapInfo({
        format: "SINGLES",
        teamAId: "tA",
        teamBId: "tB",
        teamMembersByTeamId: { tA: [], tB: ["p2"] },
        handicapByPlayerId: { p2: 12 },
        teamDisplayName,
      }),
    ).toBe(null);
  });
});
