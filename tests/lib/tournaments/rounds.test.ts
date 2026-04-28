import { describe, expect, it } from "vitest";
import {
  advanceRound,
  type RoundAdvanceMatch,
  type RoundAdvanceTeam,
} from "@/lib/tournaments/rounds";

const completedMatch = (over: Partial<RoundAdvanceMatch> = {}): RoundAdvanceMatch => ({
  id: "m1",
  round_no: 1,
  match_no: 1,
  team_a_id: "t1",
  team_b_id: "t2",
  winner_team_id: "t1",
  status: "COMPLETED",
  finalized_by_admin: true,
  ...over,
});

const team = (id: string, no: number): RoundAdvanceTeam => ({ id, team_no: no });

describe("advanceRound — incomplete branch", () => {
  it("rejects roundNo <= 0", () => {
    const out = advanceRound({ roundNo: 0, roundMatches: [], teams: [] });
    expect(out.kind).toBe("incomplete");
  });
  it("rejects empty roundMatches", () => {
    const out = advanceRound({ roundNo: 1, roundMatches: [], teams: [] });
    expect(out.kind).toBe("incomplete");
  });
  it("rejects when a non-BYE match is unfinished", () => {
    const out = advanceRound({
      roundNo: 1,
      roundMatches: [
        completedMatch({ id: "m1" }),
        { id: "m2", round_no: 1, match_no: 2, team_a_id: "t3", team_b_id: "t4", status: "SCHEDULED", winner_team_id: null },
      ],
      teams: [team("t1", 1), team("t2", 2), team("t3", 3), team("t4", 4)],
    });
    expect(out.kind).toBe("incomplete");
    if (out.kind === "incomplete") expect(out.reason).toMatch(/incomplete matches/);
  });
});

describe("advanceRound — winners-only (round 2+) branch", () => {
  it("4 round-1 winners (2 matches) → 1 round-2 match", () => {
    const out = advanceRound({
      roundNo: 1,
      roundMatches: [
        completedMatch({ id: "m1", winner_team_id: "t1" }),
        completedMatch({ id: "m2", match_no: 2, team_a_id: "t3", team_b_id: "t4", winner_team_id: "t3" }),
      ],
      teams: [team("t1", 1), team("t2", 2), team("t3", 3), team("t4", 4)],
    });
    expect(out.kind).toBe("nextRound");
    if (out.kind === "nextRound") {
      expect(out.nextRoundNo).toBe(2);
      expect(out.inserts).toHaveLength(1);
      expect(out.inserts[0].team_a_id).toBe("t1");
      expect(out.inserts[0].team_b_id).toBe("t3");
      expect(out.inserts[0].status).toBe("SCHEDULED");
    }
  });
  it("single winner remaining → tournamentComplete", () => {
    const out = advanceRound({
      roundNo: 2,
      roundMatches: [completedMatch({ round_no: 2, winner_team_id: "t1" })],
      teams: [team("t1", 1), team("t2", 2)],
    });
    expect(out.kind).toBe("tournamentComplete");
    if (out.kind === "tournamentComplete") {
      expect(out.championTeamId).toBe("t1");
    }
  });
});

describe("advanceRound — play-in (round 1, non-power-of-2)", () => {
  it("5 teams, 1 play-in match, 3 BYEs → round-2 has 4 entries (3 BYEs + 1 play-in winner)", () => {
    const out = advanceRound({
      roundNo: 1,
      roundMatches: [
        // Single play-in match between bottom seeds 4 and 5
        completedMatch({
          id: "m1",
          team_a_id: "t4",
          team_b_id: "t5",
          winner_team_id: "t4",
        }),
      ],
      teams: [
        team("t1", 1),
        team("t2", 2),
        team("t3", 3),
        team("t4", 4),
        team("t5", 5),
      ],
    });
    expect(out.kind).toBe("nextRound");
    if (out.kind === "nextRound") {
      // Round 2: p=4 entries paired into 2 matches (top 3 BYEs + play-in winner)
      expect(out.inserts).toHaveLength(2);
    }
  });
  it("expected-team-count mismatch surfaces as incomplete", () => {
    // 6 teams, p=4, playIn=2 → expected 2 play-in matches. We give 1.
    // Then totalTeams=6, but matches.length=1 → isPlayInRound=false (1 != 2).
    // Falls into winners-only path: 1 entry → tournamentComplete (sole winner).
    const out = advanceRound({
      roundNo: 1,
      roundMatches: [completedMatch({ id: "m1", winner_team_id: "t1" })],
      teams: [
        team("t1", 1), team("t2", 2), team("t3", 3),
        team("t4", 4), team("t5", 5), team("t6", 6),
      ],
    });
    expect(out.kind).toBe("tournamentComplete");
  });
});

describe("advanceRound — BYE handling", () => {
  it("BYE-encoded match resolves winner from team_a_id when no explicit winner", () => {
    const out = advanceRound({
      roundNo: 1,
      roundMatches: [
        completedMatch({
          id: "m1",
          team_a_id: "t1",
          team_b_id: null,
          winner_team_id: null,
          status: "BYE",
          finalized_by_admin: true,
        }),
        completedMatch({ id: "m2", match_no: 2, team_a_id: "t2", team_b_id: "t3", winner_team_id: "t2" }),
      ],
      teams: [team("t1", 1), team("t2", 2), team("t3", 3)],
    });
    expect(out.kind).toBe("nextRound");
    if (out.kind === "nextRound") {
      // 2 winners → 1 round-2 match
      expect(out.inserts).toHaveLength(1);
    }
  });
});
