import { describe, expect, it } from "vitest";

import {
  dbStatusToPrimitive,
  primitiveStatusToDb,
  dbFormatToPrimitive,
  dbHandicapRuleToPrimitive,
  matchRowToPrimitive,
  matchRowToCompletionMatch,
  matchRowToRoundAdvanceMatch,
  teamRowToRoundAdvanceTeam,
  entryRowToSeedingTeam,
  teamRowToSeedingTeam,
  roundAdvanceInsertToMatchInsert,
  knockoutInsertToMatchInsert,
  type DbMatchRow,
  type DbTournamentEntryRow,
  type DbTournamentTeamRow,
} from "@/lib/tournaments/adapters";
import type { RoundAdvanceInsert } from "@/lib/tournaments/rounds";
import type { KnockoutInsert } from "@/lib/tournaments/brackets/knockout";

// -------------------- fixtures --------------------

function matchRow(over: Partial<DbMatchRow> = {}): DbMatchRow {
  return {
    id: "m1",
    tournament_id: "t1",
    home_team_id: "team-a",
    away_team_id: "team-b",
    home_shots: 21,
    away_shots: 14,
    home_ends_won: 12,
    away_ends_won: 6,
    rink_id: null,
    round: 1,
    bracket_slot: null,
    section_label: null,
    status: "completed",
    starts_at: null,
    ends_at: null,
    winner_team_id: "team-a",
    notes: null,
    match_no: 1,
    finalized_by_admin: false,
    slot_a_source_type: null,
    slot_a_source_match_id: null,
    slot_b_source_type: null,
    slot_b_source_match_id: null,
    created_at: "2026-04-29T00:00:00Z",
    updated_at: "2026-04-29T00:00:00Z",
    ...over,
  };
}

function entryRow(over: Partial<DbTournamentEntryRow> = {}): DbTournamentEntryRow {
  return {
    id: "e1",
    tournament_id: "t1",
    club_id: "c1",
    profile_id: null,
    team_name: null,
    seed: 5,
    withdrawn: false,
    notes: null,
    created_at: "2026-04-29T00:00:00Z",
    updated_at: "2026-04-29T00:00:00Z",
    ...over,
  };
}

function teamRow(over: Partial<DbTournamentTeamRow> = {}): DbTournamentTeamRow {
  return {
    id: "tm1",
    tournament_id: "t1",
    club_id: null,
    name: null,
    seed: 3,
    section_label: null,
    handicap_shots: 0,
    withdrawn: false,
    created_at: "2026-04-29T00:00:00Z",
    updated_at: "2026-04-29T00:00:00Z",
    ...over,
  };
}

// -------------------- status case-map --------------------

describe("dbStatusToPrimitive", () => {
  it("scheduled → SCHEDULED", () => {
    expect(dbStatusToPrimitive("scheduled", false)).toBe("SCHEDULED");
  });
  it("in_progress → IN_PLAY", () => {
    expect(dbStatusToPrimitive("in_progress", false)).toBe("IN_PLAY");
  });
  it("completed → COMPLETED when not finalized_by_admin", () => {
    expect(dbStatusToPrimitive("completed", false)).toBe("COMPLETED");
  });
  it("completed → FINAL when finalized_by_admin", () => {
    expect(dbStatusToPrimitive("completed", true)).toBe("FINAL");
  });
  it("walkover → BYE", () => {
    expect(dbStatusToPrimitive("walkover", false)).toBe("BYE");
  });
  it("cancelled → CANCELLED", () => {
    expect(dbStatusToPrimitive("cancelled", false)).toBe("CANCELLED");
  });
});

describe("primitiveStatusToDb", () => {
  it("SCHEDULED + OPEN both collapse to scheduled, finalizedByAdmin false", () => {
    expect(primitiveStatusToDb("SCHEDULED")).toEqual({
      status: "scheduled",
      finalizedByAdmin: false,
    });
    expect(primitiveStatusToDb("OPEN")).toEqual({
      status: "scheduled",
      finalizedByAdmin: false,
    });
  });
  it("IN_PLAY → in_progress", () => {
    expect(primitiveStatusToDb("IN_PLAY").status).toBe("in_progress");
  });
  it("COMPLETED → completed, finalizedByAdmin false", () => {
    expect(primitiveStatusToDb("COMPLETED")).toEqual({
      status: "completed",
      finalizedByAdmin: false,
    });
  });
  it("FINAL → completed, finalizedByAdmin true", () => {
    expect(primitiveStatusToDb("FINAL")).toEqual({
      status: "completed",
      finalizedByAdmin: true,
    });
  });
  it("BYE → walkover", () => {
    expect(primitiveStatusToDb("BYE").status).toBe("walkover");
  });
  it("CANCELLED → cancelled", () => {
    expect(primitiveStatusToDb("CANCELLED").status).toBe("cancelled");
  });

  it("round-trips for the non-synthetic statuses", () => {
    const statuses = ["SCHEDULED", "IN_PLAY", "COMPLETED", "FINAL", "BYE", "CANCELLED"] as const;
    for (const s of statuses) {
      const db = primitiveStatusToDb(s);
      expect(dbStatusToPrimitive(db.status, db.finalizedByAdmin)).toBe(s);
    }
  });
});

// -------------------- format / handicap_rule case-map --------------------

describe("dbFormatToPrimitive", () => {
  it("maps every BSA discipline lowercase → uppercase (Triples first-class)", () => {
    expect(dbFormatToPrimitive("singles")).toBe("SINGLES");
    expect(dbFormatToPrimitive("pairs")).toBe("PAIRS");
    expect(dbFormatToPrimitive("triples")).toBe("TRIPLES");
    expect(dbFormatToPrimitive("fours")).toBe("FOURS");
    expect(dbFormatToPrimitive("mixed_pairs")).toBe("MIXED_PAIRS");
  });
});

describe("dbHandicapRuleToPrimitive", () => {
  it("maps both rule values lowercase → uppercase", () => {
    expect(dbHandicapRuleToPrimitive("scratch")).toBe("SCRATCH");
    expect(dbHandicapRuleToPrimitive("handicap_start")).toBe("HANDICAP_START");
  });
});

// -------------------- match row → primitive shape --------------------

describe("matchRowToPrimitive", () => {
  it("renames home/away → team_a/team_b, home/away_shots → score_a/score_b, round → round_no", () => {
    const out = matchRowToPrimitive(
      matchRow({
        home_team_id: "h1",
        away_team_id: "a1",
        home_shots: 18,
        away_shots: 12,
        round: 3,
      }),
    );
    expect(out.team_a_id).toBe("h1");
    expect(out.team_b_id).toBe("a1");
    expect(out.score_a).toBe(18);
    expect(out.score_b).toBe(12);
    expect(out.round_no).toBe(3);
  });

  it("preserves id, tournament_id-irrelevant primitive fields, winner_team_id, slot_*", () => {
    const out = matchRowToPrimitive(
      matchRow({
        slot_a_source_type: "WINNER_OF_MATCH",
        slot_a_source_match_id: "m-prev-1",
        slot_b_source_type: "BYE",
        slot_b_source_match_id: null,
      }),
    );
    expect(out.id).toBe("m1");
    expect(out.winner_team_id).toBe("team-a");
    expect(out.slot_a_source_type).toBe("WINNER_OF_MATCH");
    expect(out.slot_a_source_match_id).toBe("m-prev-1");
    expect(out.slot_b_source_type).toBe("BYE");
    expect(out.slot_b_source_match_id).toBe(null);
  });

  it("case-maps status + carries finalized_by_admin through", () => {
    expect(matchRowToPrimitive(matchRow({ status: "scheduled" })).status).toBe("SCHEDULED");
    expect(matchRowToPrimitive(matchRow({ status: "in_progress" })).status).toBe("IN_PLAY");
    expect(
      matchRowToPrimitive(matchRow({ status: "completed", finalized_by_admin: true })).status,
    ).toBe("FINAL");
    expect(
      matchRowToPrimitive(matchRow({ status: "completed", finalized_by_admin: false })).status,
    ).toBe("COMPLETED");
    expect(matchRowToPrimitive(matchRow({ status: "walkover" })).status).toBe("BYE");
    expect(matchRowToPrimitive(matchRow({ status: "cancelled" })).status).toBe("CANCELLED");
  });

  it("null-team open match — no scores, no winner, all nullable fields null", () => {
    const out = matchRowToPrimitive(
      matchRow({
        status: "scheduled",
        home_team_id: null,
        away_team_id: null,
        home_shots: 0,
        away_shots: 0,
        winner_team_id: null,
      }),
    );
    expect(out.team_a_id).toBe(null);
    expect(out.team_b_id).toBe(null);
    expect(out.winner_team_id).toBe(null);
    // Note: home_shots/away_shots default to 0 in the schema, not null. The
    // primitive carries that through; missing-scores logic uses team_b_id
    // null + status to detect "no result" instead.
    expect(out.score_a).toBe(0);
    expect(out.score_b).toBe(0);
  });

  it("type-narrowed re-exports are structurally compatible", () => {
    const row = matchRow();
    const completion = matchRowToCompletionMatch(row);
    const advance = matchRowToRoundAdvanceMatch(row);
    expect(completion.id).toBe(row.id);
    expect(advance.id).toBe(row.id);
  });

  it("BYE-encoded match (walkover status, away_team_id null) round-trips", () => {
    const out = matchRowToPrimitive(
      matchRow({
        status: "walkover",
        away_team_id: null,
        slot_b_source_type: "BYE",
      }),
    );
    expect(out.status).toBe("BYE");
    expect(out.team_b_id).toBe(null);
    expect(out.slot_b_source_type).toBe("BYE");
  });
});

// -------------------- team / entry row → primitive --------------------

describe("teamRowToRoundAdvanceTeam", () => {
  it("treats seed as team_no", () => {
    expect(teamRowToRoundAdvanceTeam(teamRow({ id: "t1", seed: 5 }))).toEqual({
      id: "t1",
      team_no: 5,
    });
  });
  it("null seed falls back to large sentinel (sorts to bottom in advance)", () => {
    const out = teamRowToRoundAdvanceTeam(teamRow({ id: "t-unseeded", seed: null }));
    expect(out.id).toBe("t-unseeded");
    expect(out.team_no).toBeGreaterThan(1000);
  });
});

describe("entryRowToSeedingTeam", () => {
  it("returns id + seed verbatim", () => {
    expect(entryRowToSeedingTeam(entryRow({ id: "e1", seed: 7 }))).toEqual({
      id: "e1",
      seed: 7,
    });
  });
  it("preserves null seed (seedEntries handles unseeded entries explicitly)", () => {
    expect(entryRowToSeedingTeam(entryRow({ id: "e2", seed: null }))).toEqual({
      id: "e2",
      seed: null,
    });
  });
});

describe("teamRowToSeedingTeam", () => {
  it("returns id + seed verbatim from a tournament_teams row", () => {
    expect(teamRowToSeedingTeam(teamRow({ id: "t1", seed: 2 }))).toEqual({
      id: "t1",
      seed: 2,
    });
  });
});

// -------------------- primitive insert → DB Insert --------------------

describe("roundAdvanceInsertToMatchInsert", () => {
  it("renames team_a/b → home/away, round_no → round, attaches tournament_id", () => {
    const insert: RoundAdvanceInsert = {
      round_no: 2,
      match_no: 1,
      team_a_id: "t1",
      team_b_id: "t2",
      slot_a_source_type: "TEAM",
      slot_a_source_match_id: null,
      slot_b_source_type: "WINNER_OF_MATCH",
      slot_b_source_match_id: "m-feeder",
      status: "SCHEDULED",
    };
    const out = roundAdvanceInsertToMatchInsert(insert, "tour-1");
    expect(out.tournament_id).toBe("tour-1");
    expect(out.round).toBe(2);
    expect(out.match_no).toBe(1);
    expect(out.home_team_id).toBe("t1");
    expect(out.away_team_id).toBe("t2");
    expect(out.slot_a_source_type).toBe("TEAM");
    expect(out.slot_b_source_type).toBe("WINNER_OF_MATCH");
    expect(out.slot_b_source_match_id).toBe("m-feeder");
    expect(out.status).toBe("scheduled");
    expect(out.finalized_by_admin).toBe(false);
  });

  it("OPEN status (one team filled, other pending) collapses to scheduled", () => {
    const insert: RoundAdvanceInsert = {
      round_no: 2,
      match_no: 1,
      team_a_id: "t1",
      team_b_id: null,
      slot_a_source_type: "TEAM",
      slot_a_source_match_id: null,
      slot_b_source_type: "WINNER_OF_MATCH",
      slot_b_source_match_id: "m-feeder",
      status: "OPEN",
    };
    const out = roundAdvanceInsertToMatchInsert(insert, "tour-1");
    expect(out.status).toBe("scheduled");
    expect(out.finalized_by_admin).toBe(false);
    expect(out.away_team_id).toBe(null);
  });
});

describe("knockoutInsertToMatchInsert", () => {
  it("round-1 SCHEDULED match with two teams → scheduled DB row", () => {
    const insert: KnockoutInsert = {
      round_no: 1,
      match_no: 1,
      team_a_id: "t1",
      team_b_id: "t2",
      slot_a_source_type: "TEAM",
      slot_a_source_match_id: null,
      slot_b_source_type: "TEAM",
      slot_b_source_match_id: null,
      status: "SCHEDULED",
    };
    const out = knockoutInsertToMatchInsert(insert, "tour-1");
    expect(out.tournament_id).toBe("tour-1");
    expect(out.round).toBe(1);
    expect(out.home_team_id).toBe("t1");
    expect(out.away_team_id).toBe("t2");
    expect(out.status).toBe("scheduled");
  });

  it("BYE (single-team) match → walkover DB status, away_team_id null, slot_b_source_type 'BYE'", () => {
    const insert: KnockoutInsert = {
      round_no: 1,
      match_no: 5,
      team_a_id: "t-lone",
      team_b_id: null,
      slot_a_source_type: "TEAM",
      slot_a_source_match_id: null,
      slot_b_source_type: "BYE",
      slot_b_source_match_id: null,
      status: "BYE",
    };
    const out = knockoutInsertToMatchInsert(insert, "tour-1");
    expect(out.status).toBe("walkover");
    expect(out.home_team_id).toBe("t-lone");
    expect(out.away_team_id).toBe(null);
    expect(out.slot_b_source_type).toBe("BYE");
  });
});

// -------------------- round-trip coverage --------------------

describe("round-trip — DB row → primitive → DB Insert (advance flow)", () => {
  it("an advance-round-2 spec converted from a DB-loaded round-1 winner round-trips column-for-column", () => {
    // Simulate: round-1 finalised match with team_a winner
    const winnerRow = matchRow({
      id: "r1m1",
      round: 1,
      match_no: 1,
      home_team_id: "t1",
      away_team_id: "t2",
      home_shots: 21,
      away_shots: 14,
      winner_team_id: "t1",
      status: "completed",
      finalized_by_admin: true,
    });

    // Adapter produces the primitive shape.
    const primitive = matchRowToRoundAdvanceMatch(winnerRow);
    expect(primitive.team_a_id).toBe("t1");
    expect(primitive.winner_team_id).toBe("t1");
    expect(primitive.status).toBe("FINAL");

    // Pretend rounds.advanceRound emitted this for round-2:
    const roundTwoInsert: RoundAdvanceInsert = {
      round_no: 2,
      match_no: 1,
      team_a_id: "t1",
      team_b_id: null,
      slot_a_source_type: "TEAM",
      slot_a_source_match_id: null,
      slot_b_source_type: "WINNER_OF_MATCH",
      slot_b_source_match_id: "r1m2",
      status: "OPEN",
    };

    const dbInsert = roundAdvanceInsertToMatchInsert(roundTwoInsert, "tour-1");
    expect(dbInsert.tournament_id).toBe("tour-1");
    expect(dbInsert.round).toBe(2);
    expect(dbInsert.home_team_id).toBe("t1");
    expect(dbInsert.away_team_id).toBe(null);
    expect(dbInsert.slot_a_source_type).toBe("TEAM");
    expect(dbInsert.slot_b_source_type).toBe("WINNER_OF_MATCH");
    expect(dbInsert.slot_b_source_match_id).toBe("r1m2");
    expect(dbInsert.status).toBe("scheduled");
    expect(dbInsert.finalized_by_admin).toBe(false);
  });
});
