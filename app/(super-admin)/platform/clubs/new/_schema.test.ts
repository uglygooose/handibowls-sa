import { describe, expect, it } from "vitest";

import {
  detailsSchema,
  greensSchema,
  isThemePreset,
  playerSchema,
  playersSchema,
  slugify,
  WIZARD_DEFAULTS,
  wizardSchema,
} from "./_schema";

const DETAILS_HAPPY = {
  name: "Gauteng North Bowls Club",
  short_name: "GNBC",
  slug: "gauteng-north",
  district_id: "123e4567-e89b-42d3-a456-426614174000",
  city: "Pretoria",
  contact_email: "secretary@club.co.za",
  contact_phone: "",
  logo_path: "",
  theme_preset: "ocean-blue" as const,
};

describe("slugify", () => {
  it("lowercases, NFKD-normalises, and hyphenates", () => {
    expect(slugify("Gauteng NORTH")).toBe("gauteng-north");
    expect(slugify("Pretória Central!")).toBe("pretoria-central");
    expect(slugify("  trim  me  ")).toBe("trim-me");
  });

  it("caps at 60 characters", () => {
    expect(slugify("a".repeat(200))).toHaveLength(60);
  });
});

describe("isThemePreset", () => {
  it("accepts a known preset", () => {
    expect(isThemePreset("ocean-blue")).toBe(true);
  });

  it("rejects the empty string and unknown strings", () => {
    expect(isThemePreset("")).toBe(false);
    expect(isThemePreset("not-a-preset")).toBe(false);
    expect(isThemePreset(42)).toBe(false);
  });
});

describe("detailsSchema", () => {
  it("rejects empty theme_preset", () => {
    const result = detailsSchema.safeParse({ ...DETAILS_HAPPY, theme_preset: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join(".") === "theme_preset"),
      ).toBe(true);
    }
  });

  it("requires a valid slug", () => {
    const result = detailsSchema.safeParse({ ...DETAILS_HAPPY, slug: "NOT-OK!" });
    expect(result.success).toBe(false);
  });

  it("accepts a happy-path payload", () => {
    const result = detailsSchema.safeParse(DETAILS_HAPPY);
    expect(result.success).toBe(true);
  });
});

describe("greensSchema", () => {
  it("enforces at least one green", () => {
    expect(greensSchema.safeParse({ greens: [] }).success).toBe(false);
  });

  it("clamps rink_count to 1..12", () => {
    expect(
      greensSchema.safeParse({ greens: [{ name: "A", rink_count: 0 }] }).success,
    ).toBe(false);
    expect(
      greensSchema.safeParse({ greens: [{ name: "A", rink_count: 13 }] }).success,
    ).toBe(false);
    expect(
      greensSchema.safeParse({ greens: [{ name: "A", rink_count: 6 }] }).success,
    ).toBe(true);
  });

  it("caps greens at 10", () => {
    const greens = Array.from({ length: 11 }, (_, i) => ({
      name: `Green ${i + 1}`,
      rink_count: 6,
    }));
    expect(greensSchema.safeParse({ greens }).success).toBe(false);
  });
});

describe("playerSchema / playersSchema", () => {
  it("requires a valid email", () => {
    expect(
      playerSchema.safeParse({
        first_name: "A",
        last_name: "B",
        email: "not-an-email",
        is_club_admin: false,
      }).success,
    ).toBe(false);
  });

  it("caps players at 50", () => {
    const players = Array.from({ length: 51 }, (_, i) => ({
      first_name: "First",
      last_name: "Last",
      email: `p${i}@club.co.za`,
      is_club_admin: false,
    }));
    expect(playersSchema.safeParse({ players }).success).toBe(false);
  });
});

describe("wizardSchema + WIZARD_DEFAULTS", () => {
  it("the defaults fail validation (theme + district + city + slug empty)", () => {
    expect(wizardSchema.safeParse(WIZARD_DEFAULTS).success).toBe(false);
  });

  it("accepts a fully filled payload", () => {
    const result = wizardSchema.safeParse({
      details: DETAILS_HAPPY,
      adminInvite: { admin_email: "admin@club.co.za" },
      greens: { greens: [{ name: "A", rink_count: 6 }] },
      players: { players: [] },
    });
    expect(result.success).toBe(true);
  });
});
