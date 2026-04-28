import { describe, expect, it } from "vitest";
import {
  memberNameWithHandicap,
  slotLabel,
  slotMembersLine,
  teamDisplayName,
  teamLabel,
  teamMembersLine,
  winnerLabelForMatch,
} from "@/lib/tournaments/teams";

const teamById = { t1: { team_no: 1 }, t2: { team_no: 2 } };
const teamMembersByTeamId = { t1: ["p1", "p2"], t2: ["p3"] };
const nameByPlayerId = { p1: "Alice", p2: "Bob", p3: "Carol" };
const handicapByPlayerId = { p1: 8, p2: null, p3: 12 };

describe("teamLabel", () => {
  it("returns 'Team N'", () => {
    expect(teamLabel("t1", teamById)).toBe("Team 1");
  });
  it("'Team -' when missing", () => {
    expect(teamLabel(null, teamById)).toBe("Team -");
    expect(teamLabel("missing", teamById)).toBe("Team -");
  });
});

describe("memberNameWithHandicap", () => {
  it("plain name when not handicap", () => {
    expect(
      memberNameWithHandicap("p1", { nameByPlayerId, handicapByPlayerId, isHandicapTournament: false }),
    ).toBe("Alice");
  });
  it("appends handicap when available", () => {
    expect(
      memberNameWithHandicap("p1", { nameByPlayerId, handicapByPlayerId, isHandicapTournament: true }),
    ).toBe("Alice (8)");
  });
  it("omits suffix when handicap is null", () => {
    expect(
      memberNameWithHandicap("p2", { nameByPlayerId, handicapByPlayerId, isHandicapTournament: true }),
    ).toBe("Bob");
  });
});

describe("teamDisplayName", () => {
  const common = {
    teamMembersByTeamId,
    teamById,
    nameByPlayerId,
    handicapByPlayerId,
    isHandicapTournament: false,
  };
  it("SINGLES returns first member name", () => {
    expect(teamDisplayName({ teamId: "t2", format: "SINGLES", ...common })).toBe("Carol");
  });
  it("DOUBLES returns 'Team N'", () => {
    expect(teamDisplayName({ teamId: "t1", format: "DOUBLES", ...common })).toBe("Team 1");
  });
  it("BYE for null teamId", () => {
    expect(teamDisplayName({ teamId: null, format: "SINGLES", ...common })).toBe("BYE");
  });
});

describe("teamMembersLine", () => {
  const common = {
    teamMembersByTeamId,
    nameByPlayerId,
    handicapByPlayerId,
    isHandicapTournament: true,
  };
  it("joins member names with asterisk", () => {
    expect(teamMembersLine({ teamId: "t1", ...common })).toBe("Alice (8) * Bob");
  });
  it("'Members not loaded' when empty", () => {
    expect(
      teamMembersLine({ teamId: "t3", teamMembersByTeamId, nameByPlayerId, handicapByPlayerId, isHandicapTournament: false }),
    ).toBe("Members not loaded");
  });
  it("'-' when teamId null", () => {
    expect(teamMembersLine({ teamId: null, ...common })).toBe("-");
  });
});

describe("winnerLabelForMatch", () => {
  it("formats as 'M<n> W' when present", () => {
    expect(winnerLabelForMatch("x", { x: 7 })).toBe("M7 W");
  });
  it("fallback 'Winner' when missing", () => {
    expect(winnerLabelForMatch(null, {})).toBe("Winner");
    expect(winnerLabelForMatch("x", { x: null })).toBe("Winner");
  });
});

describe("slotLabel", () => {
  const common = {
    format: "SINGLES",
    teamMembersByTeamId,
    teamById,
    nameByPlayerId,
    handicapByPlayerId,
    isHandicapTournament: false,
    matchNoById: { m1: 3 },
  };
  it("falls back to TBD", () => {
    expect(slotLabel({ teamId: null, sourceType: null, sourceMatchId: null, ...common })).toBe("TBD");
  });
  it("BYE source renders 'BYE'", () => {
    expect(slotLabel({ teamId: null, sourceType: "BYE", sourceMatchId: null, ...common })).toBe("BYE");
  });
  it("WINNER_OF_MATCH renders 'M<n> W'", () => {
    expect(
      slotLabel({ teamId: null, sourceType: "WINNER_OF_MATCH", sourceMatchId: "m1", ...common }),
    ).toBe("M3 W");
  });
  it("renders team display when teamId set", () => {
    expect(slotLabel({ teamId: "t2", sourceType: null, sourceMatchId: null, ...common })).toBe("Carol");
  });
});

describe("slotMembersLine", () => {
  const common = {
    teamMembersByTeamId,
    nameByPlayerId,
    handicapByPlayerId,
    isHandicapTournament: false,
  };
  it("Pending winner for WINNER_OF_MATCH", () => {
    expect(
      slotMembersLine({ teamId: null, sourceType: "WINNER_OF_MATCH", sourceMatchId: "m1", ...common }),
    ).toBe("Pending winner");
  });
  it("BYE source renders 'BYE'", () => {
    expect(slotMembersLine({ teamId: null, sourceType: "BYE", sourceMatchId: null, ...common })).toBe("BYE");
  });
  it("Pending fallback", () => {
    expect(slotMembersLine({ teamId: null, sourceType: null, sourceMatchId: null, ...common })).toBe("Pending");
  });
  it("delegates to teamMembersLine when teamId set", () => {
    expect(
      slotMembersLine({ teamId: "t1", sourceType: null, sourceMatchId: null, ...common }),
    ).toBe("Alice * Bob");
  });
});
