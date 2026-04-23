import { z } from "zod";

import { THEME_PRESETS, type ThemePreset } from "@/components/brand/theme-presets";

export function isThemePreset(value: unknown): value is ThemePreset {
  return (
    typeof value === "string" &&
    (THEME_PRESETS as readonly string[]).includes(value)
  );
}

// Wizard-shape Zod schema. Each top-level key gates one wizard step; on
// "Next" we only re-validate the current step's subtree via form.trigger.
// Publish (step 5) re-validates the whole thing and then remaps onto the
// Phase-4a createClub RPC payload.

const emailField = z.string().trim().email("Enter a valid email").max(254);

export const slugRegex = /^[a-z0-9-]+$/;

export const detailsSchema = z.object({
  name: z.string().trim().min(1, "Club name is required").max(120),
  short_name: z.string().trim().max(20).optional().default(""),
  slug: z
    .string()
    .trim()
    .min(3, "Slug must be at least 3 characters")
    .max(60)
    .regex(slugRegex, "Lowercase letters, digits, and hyphens only"),
  district_id: z.string().uuid("Select a district"),
  city: z.string().trim().min(1, "City is required").max(80),
  contact_email: emailField.or(z.literal("")).optional().default(""),
  contact_phone: z.string().trim().max(40).optional().default(""),
  logo_path: z.string().trim().max(255).optional().default(""),
  // Union of the 9 presets and "" so the wizard can start unselected (no
  // forced default). The superRefine below rejects "" at validation time;
  // at publish the union is narrowed via isThemePreset().
  theme_preset: z.union([z.enum(THEME_PRESETS), z.literal("")]),
}).superRefine((data, ctx) => {
  if (data.theme_preset === "") {
    ctx.addIssue({
      code: "custom",
      path: ["theme_preset"],
      message: "Pick a theme preset",
    });
  }
});

export type DetailsInput = z.infer<typeof detailsSchema>;

export const adminInviteSchema = z.object({
  admin_email: emailField,
});

export type AdminInviteInput = z.infer<typeof adminInviteSchema>;

export const greenSchema = z.object({
  name: z.string().trim().min(1, "Green name is required").max(80),
  rink_count: z.coerce
    .number({ message: "Rink count is required" })
    .int("Whole numbers only")
    .min(1, "Minimum 1 rink")
    .max(12, "Maximum 12 rinks"),
});

export type GreenInput = z.infer<typeof greenSchema>;

export const greensSchema = z.object({
  greens: z.array(greenSchema).min(1, "At least one green required").max(10),
});

export type GreensInput = z.infer<typeof greensSchema>;

export const playerSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(80),
  last_name: z.string().trim().min(1, "Last name is required").max(80),
  email: emailField,
  is_club_admin: z.boolean().default(false),
});

export type PlayerInput = z.infer<typeof playerSchema>;

export const playersSchema = z.object({
  players: z.array(playerSchema).max(50, "Maximum 50 players in one batch"),
});

export type PlayersInput = z.infer<typeof playersSchema>;

// Master wizard schema: one form covers all five steps.
export const wizardSchema = z.object({
  details: detailsSchema,
  adminInvite: adminInviteSchema,
  greens: greensSchema,
  players: playersSchema,
});

export type WizardFormValues = z.infer<typeof wizardSchema>;

export const WIZARD_DEFAULTS: WizardFormValues = {
  details: {
    name: "",
    short_name: "",
    slug: "",
    district_id: "",
    city: "",
    contact_email: "",
    contact_phone: "",
    logo_path: "",
    theme_preset: "",
  },
  adminInvite: { admin_email: "" },
  greens: { greens: [{ name: "", rink_count: 6 }] },
  players: { players: [] },
};

export const STEP_COUNT = 5;

export const STEP_KEYS = [
  "details",
  "adminInvite",
  "greens",
  "players",
  "review",
] as const satisfies readonly (keyof WizardFormValues | "review")[];

export const STEP_LABELS: Record<(typeof STEP_KEYS)[number], string> = {
  details: "Club details",
  adminInvite: "Admin invite",
  greens: "Greens & rinks",
  players: "Initial players",
  review: "Review & publish",
};

// Subtree keys to validate on Next. Step 5 validates the whole schema via
// form.trigger() with no argument; every earlier step validates its slice.
export const STEP_TRIGGERS: Record<number, readonly (keyof WizardFormValues)[] | null> = {
  1: ["details"],
  2: ["adminInvite"],
  3: ["greens"],
  4: ["players"],
  5: null,
};

// Slugify a club name into the canonical lowercase-hyphen form. Step 1 calls
// this on every keystroke of `name` unless the user has manually edited
// `slug`, at which point we freeze auto-derivation.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
