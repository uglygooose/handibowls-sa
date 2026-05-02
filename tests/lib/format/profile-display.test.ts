import { describe, expect, it } from "vitest";

import { formatPlayerName } from "@/lib/format/profile-display";

describe("formatPlayerName", () => {
  it("renders 'First Last' for an active profile with both names", () => {
    expect(
      formatPlayerName({ first_name: "James", last_name: "Thomas" }),
    ).toBe("James Thomas");
  });

  it("renders just the first name when last_name is NULL", () => {
    expect(
      formatPlayerName({ first_name: "James", last_name: null }),
    ).toBe("James");
  });

  it("renders just the last name when first_name is NULL", () => {
    expect(
      formatPlayerName({ first_name: null, last_name: "Thomas" }),
    ).toBe("Thomas");
  });

  it("renders 'Deleted player' for an anonymised profile (both names NULL)", () => {
    expect(formatPlayerName({ first_name: null, last_name: null })).toBe(
      "Deleted player",
    );
  });

  it("renders 'Deleted player' for null input", () => {
    expect(formatPlayerName(null)).toBe("Deleted player");
  });

  it("renders 'Deleted player' for undefined input", () => {
    expect(formatPlayerName(undefined)).toBe("Deleted player");
  });

  it("renders 'Deleted player' for empty-string names", () => {
    expect(formatPlayerName({ first_name: "", last_name: "" })).toBe(
      "Deleted player",
    );
  });

  it("renders 'Deleted player' for whitespace-only names", () => {
    expect(formatPlayerName({ first_name: " ", last_name: "  " })).toBe(
      "Deleted player",
    );
  });

  it("trims whitespace around populated names", () => {
    expect(
      formatPlayerName({ first_name: "  James  ", last_name: " Thomas " }),
    ).toBe("James Thomas");
  });
});
