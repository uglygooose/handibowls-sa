import { describe, expect, it } from "vitest";
import {
  scopeLabel,
  statusLabel,
  formatLabel,
  genderLabel,
  ruleLabel,
  cleanTournamentName,
  matchStatusLabel,
} from "./labels";

describe("scopeLabel", () => {
  it("maps all scopes", () => {
    expect(scopeLabel("CLUB")).toBe("Club");
    expect(scopeLabel("DISTRICT")).toBe("District");
    expect(scopeLabel("NATIONAL")).toBe("National");
  });
});

describe("statusLabel", () => {
  it("maps all statuses", () => {
    expect(statusLabel("ANNOUNCED")).toBe("Upcoming");
    expect(statusLabel("IN_PLAY")).toBe("In-play");
    expect(statusLabel("COMPLETED")).toBe("Past");
  });
});

describe("formatLabel", () => {
  it("capitalises single-word formats", () => {
    expect(formatLabel("SINGLES")).toBe("Singles");
    expect(formatLabel("DOUBLES")).toBe("Doubles");
    expect(formatLabel("TRIPLES")).toBe("Triples");
  });
  it("renders FOUR_BALL as '4 Balls'", () => {
    expect(formatLabel("FOUR_BALL")).toBe("4 Balls");
  });
});

describe("genderLabel", () => {
  it("maps MALE/FEMALE/null", () => {
    expect(genderLabel("MALE")).toBe("Men");
    expect(genderLabel("FEMALE")).toBe("Ladies");
    expect(genderLabel(null)).toBe("Open");
    expect(genderLabel(undefined)).toBe("Open");
  });
});

describe("ruleLabel", () => {
  it("returns 'Scratch' for SCRATCH", () => {
    expect(ruleLabel("SCRATCH")).toBe("Scratch");
  });
  it("defaults to 'Handicap start'", () => {
    expect(ruleLabel("HANDICAP_START")).toBe("Handicap start");
    expect(ruleLabel(null)).toBe("Handicap start");
    expect(ruleLabel(undefined)).toBe("Handicap start");
  });
});

describe("cleanTournamentName", () => {
  it("strips trailing parenthesised suffix", () => {
    expect(cleanTournamentName("Spring Singles (Men)")).toBe("Spring Singles");
  });
  it("handles null/empty", () => {
    expect(cleanTournamentName(null)).toBe("");
    expect(cleanTournamentName("")).toBe("");
  });
  it("preserves names without suffix", () => {
    expect(cleanTournamentName("Club Championship")).toBe("Club Championship");
  });
});

describe("matchStatusLabel", () => {
  it("maps known statuses", () => {
    expect(matchStatusLabel("SCHEDULED")).toBe("Scheduled");
    expect(matchStatusLabel("IN_PLAY")).toBe("In play");
    expect(matchStatusLabel("COMPLETED")).toBe("Completed");
    expect(matchStatusLabel("OPEN")).toBe("Open");
    expect(matchStatusLabel("FINAL")).toBe("Final");
    expect(matchStatusLabel("BYE")).toBe("BYE");
  });
  it("falls back to input or '-'", () => {
    expect(matchStatusLabel("UNKNOWN")).toBe("UNKNOWN");
    expect(matchStatusLabel(null)).toBe("-");
    expect(matchStatusLabel("")).toBe("-");
  });
});
