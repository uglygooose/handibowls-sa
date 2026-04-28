import { describe, expect, it } from "vitest";
import type { TournamentCompletionMatch } from "@/lib/tournaments/completion";
import {
  bool,
  hasValue,
  hasWinnerTeamId,
  isMatchBye,
  isMatchDone,
  winnerTeamIdFromMatch,
} from "@/lib/tournaments/match";

describe("hasValue", () => {
  it("rejects null/undefined/empty", () => {
    expect(hasValue(null)).toBe(false);
    expect(hasValue(undefined)).toBe(false);
    expect(hasValue("")).toBe(false);
  });
  it("accepts non-empty values", () => {
    expect(hasValue("x")).toBe(true);
    expect(hasValue(0)).toBe(true);
    expect(hasValue(false)).toBe(true);
  });
});

describe("bool", () => {
  it("strict-equal true only", () => {
    expect(bool(true)).toBe(true);
    expect(bool("true")).toBe(false);
    expect(bool(1)).toBe(false);
    expect(bool(null)).toBe(false);
  });
});

describe("isMatchBye", () => {
  it("detects explicit BYE status", () => {
    expect(isMatchBye({ round_no: 1, status: "BYE" } as TournamentCompletionMatch)).toBe(true);
  });
  it("detects slot_b_source_type BYE", () => {
    expect(
      isMatchBye({ round_no: 1, status: "OPEN", slot_b_source_type: "BYE" } as TournamentCompletionMatch),
    ).toBe(true);
  });
  it("detects legacy missing-opponent bye", () => {
    expect(isMatchBye({ round_no: 1, status: "OPEN", team_a_id: "a" } as TournamentCompletionMatch)).toBe(true);
  });
  it("rejects normal two-team match", () => {
    expect(
      isMatchBye({
        round_no: 1,
        status: "OPEN",
        team_a_id: "a",
        team_b_id: "b",
      } as TournamentCompletionMatch),
    ).toBe(false);
  });
});

describe("isMatchDone", () => {
  it("true when COMPLETED", () => {
    expect(isMatchDone({ round_no: 1, status: "COMPLETED" } as TournamentCompletionMatch)).toBe(true);
  });
  it("true when admin finalised", () => {
    expect(
      isMatchDone({ round_no: 1, status: "OPEN", finalized_by_admin: true } as TournamentCompletionMatch),
    ).toBe(true);
  });
  it("true when has winner_team_id", () => {
    expect(
      isMatchDone({ round_no: 1, status: "OPEN", winner_team_id: "x" } as TournamentCompletionMatch),
    ).toBe(true);
  });
  it("false otherwise", () => {
    expect(isMatchDone({ round_no: 1, status: "OPEN" } as TournamentCompletionMatch)).toBe(false);
  });
});

describe("hasWinnerTeamId", () => {
  it("maps winner_team_id presence", () => {
    expect(hasWinnerTeamId({ round_no: 1, winner_team_id: "x" } as TournamentCompletionMatch)).toBe(true);
    expect(hasWinnerTeamId({ round_no: 1, winner_team_id: null } as TournamentCompletionMatch)).toBe(false);
  });
});

describe("winnerTeamIdFromMatch", () => {
  it("returns winner_team_id when set", () => {
    expect(
      winnerTeamIdFromMatch({
        round_no: 1,
        winner_team_id: "w",
      } as TournamentCompletionMatch),
    ).toBe("w");
  });
  it("returns null when not done", () => {
    expect(
      winnerTeamIdFromMatch({
        round_no: 1,
        status: "OPEN",
        team_a_id: "a",
        team_b_id: "b",
        score_a: 10,
        score_b: 8,
      } as TournamentCompletionMatch),
    ).toBe(null);
  });
  it("returns team_a_id for finalised BYE match without explicit winner", () => {
    expect(
      winnerTeamIdFromMatch({
        round_no: 1,
        status: "BYE",
        team_a_id: "a",
        finalized_by_admin: true,
      } as TournamentCompletionMatch),
    ).toBe("a");
  });
  it("returns null for an unresolved BYE (not done, no winner)", () => {
    expect(
      winnerTeamIdFromMatch({
        round_no: 1,
        status: "BYE",
        team_a_id: "a",
      } as TournamentCompletionMatch),
    ).toBe(null);
  });
  it("infers from scores when done without explicit winner", () => {
    expect(
      winnerTeamIdFromMatch({
        round_no: 1,
        status: "COMPLETED",
        team_a_id: "a",
        team_b_id: "b",
        score_a: 10,
        score_b: 8,
      } as TournamentCompletionMatch),
    ).toBe("a");
    expect(
      winnerTeamIdFromMatch({
        round_no: 1,
        status: "COMPLETED",
        team_a_id: "a",
        team_b_id: "b",
        score_a: 5,
        score_b: 9,
      } as TournamentCompletionMatch),
    ).toBe("b");
  });
  it("returns null on tie", () => {
    expect(
      winnerTeamIdFromMatch({
        round_no: 1,
        status: "COMPLETED",
        team_a_id: "a",
        team_b_id: "b",
        score_a: 7,
        score_b: 7,
      } as TournamentCompletionMatch),
    ).toBe(null);
  });
});
