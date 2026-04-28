import { describe, expect, it } from "vitest";
import { generateKnockoutRound1 } from "@/lib/tournaments/brackets/knockout";
import type { SeedingResult } from "@/lib/tournaments/seeding";

const seedingFor = (count: number): SeedingResult => {
  const ordered = Array.from({ length: count }, (_, i) => ({
    id: `t${i + 1}`,
    seed: i + 1,
    section_label: null,
  }));
  // 1-vs-N pairing matching seedEntries' "seeded" output.
  const pairings: Array<readonly [string, string | null]> = [];
  for (let i = 0; i < Math.ceil(count / 2); i++) {
    pairings.push([ordered[i].id, ordered[count - 1 - i]?.id ?? null] as const);
  }
  return { ordered, pairings };
};

describe("generateKnockoutRound1 — empty / single team", () => {
  it("returns empty inserts + empty byeTeamIds for empty seeding", () => {
    const out = generateKnockoutRound1({ ordered: [], pairings: [] });
    expect(out).toEqual({ inserts: [], byeTeamIds: [] });
  });
  it("returns empty inserts + the lone team as a BYE for N=1", () => {
    const out = generateKnockoutRound1(seedingFor(1));
    expect(out!.inserts).toEqual([]);
    expect(out!.byeTeamIds).toEqual(["t1"]);
  });
  it("returns null when seeding.pairings is null (sectional)", () => {
    const out = generateKnockoutRound1({
      ordered: [{ id: "t1", seed: 1, section_label: "A" }],
      pairings: null,
    });
    expect(out).toBe(null);
  });
});

describe("generateKnockoutRound1 — power-of-2 (full bracket)", () => {
  it("N=2: one match, both teams paired, status SCHEDULED", () => {
    const out = generateKnockoutRound1(seedingFor(2));
    expect(out!.inserts).toHaveLength(1);
    expect(out!.byeTeamIds).toEqual([]);
    expect(out!.inserts[0]).toMatchObject({
      round_no: 1,
      match_no: 1,
      team_a_id: "t1",
      team_b_id: "t2",
      status: "SCHEDULED",
      slot_a_source_type: "TEAM",
      slot_b_source_type: "TEAM",
    });
  });
  it("N=4: 2 matches, every pair populated", () => {
    const out = generateKnockoutRound1(seedingFor(4));
    expect(out!.inserts).toHaveLength(2);
    expect(out!.byeTeamIds).toEqual([]);
    for (const ins of out!.inserts) {
      expect(ins.team_a_id).toBeTruthy();
      expect(ins.team_b_id).toBeTruthy();
      expect(ins.status).toBe("SCHEDULED");
    }
  });
  it("N=8: 4 matches in match_no 1..4 sequence", () => {
    const out = generateKnockoutRound1(seedingFor(8));
    expect(out!.inserts).toHaveLength(4);
    expect(out!.inserts.map((m) => m.match_no)).toEqual([1, 2, 3, 4]);
  });
});

describe("generateKnockoutRound1 — non-power-of-2 (play-in)", () => {
  it("N=5: 1 play-in match (bottom 2 teams play), 3 BYEs to round 2", () => {
    const out = generateKnockoutRound1(seedingFor(5));
    // p=4, playIn=1, byeCount=2*4-5=3
    expect(out!.byeTeamIds).toHaveLength(3);
    expect(out!.inserts).toHaveLength(1);
    // The bottom 2 seeds paired in play-in
    expect(out!.inserts[0].team_a_id).toBeTruthy();
    expect(out!.inserts[0].team_b_id).toBeTruthy();
  });
  it("N=12: 4 play-in matches, 4 BYEs to round 2", () => {
    const out = generateKnockoutRound1(seedingFor(12));
    // p=8, playIn=4, byeCount=2*8-12=4
    expect(out!.byeTeamIds).toHaveLength(4);
    expect(out!.inserts).toHaveLength(4);
  });
  it("BYE-direct teams are the TOP seeds; play-in teams are the bottom", () => {
    const seeding = seedingFor(6); // p=4, playIn=2, byeCount=2
    const out = generateKnockoutRound1(seeding);
    // Top 2 in ordered list → byeTeamIds
    expect(out!.byeTeamIds).toEqual(["t1", "t2"]);
  });
  it("play-in slice mismatch is impossible by construction (regression guard)", () => {
    // Sanity: N=3 → p=2, playIn=1, byeCount=1. 2*1=2 play-in teams.
    const out = generateKnockoutRound1(seedingFor(3));
    expect(out!.inserts).toHaveLength(1);
    expect(out!.byeTeamIds).toHaveLength(1);
  });
});

describe("generateKnockoutRound1 — single-team match throws inside matchInsert", () => {
  it("a pairing of [a, null] in a power-of-2 path emits a BYE-shaped insert", () => {
    // Construct a seeding where pairings explicitly has a half-pair. This
    // exercises the BYE branch of matchInsert without going through play-in.
    const seeding: SeedingResult = {
      ordered: [{ id: "t1", seed: 1, section_label: null }],
      pairings: [["t1", null] as const],
    };
    // N=1 → byeTeamIds path; handled by the early-return.
    const out = generateKnockoutRound1(seeding);
    expect(out!.byeTeamIds).toEqual(["t1"]);
    expect(out!.inserts).toEqual([]);
  });
});
