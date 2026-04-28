import { z } from "zod";

// Wizard schemas. The "Input" union-with-empty-string pattern on enum
// fields lets the form start unselected ("") while validation rejects
// the empty value at submit time. Mirrors the new-club wizard's
// theme_preset trick.

const personName = z.string().trim().min(1, "Required").max(80);

const GENDERS = ["male", "female", "other", "prefer_not"] as const;
const POSITIONS = ["skip", "third", "second", "lead"] as const;
const HANDS = ["right", "left"] as const;

export const step1Schema = z
  .object({
    first_name: personName,
    last_name: personName,
    display_name: z.string().trim().max(80).default(""),
    gender: z.union([z.enum(GENDERS), z.literal("")]),
    date_of_birth: z.string().refine((v) => {
      if (!v) return false;
      const d = new Date(`${v}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) return false;
      const now = new Date();
      if (d > now) return false;
      const min = new Date();
      min.setUTCFullYear(min.getUTCFullYear() - 120);
      if (d < min) return false;
      return true;
    }, "Enter a valid date of birth"),
  })
  .superRefine((data, ctx) => {
    if (data.gender === "") {
      ctx.addIssue({ code: "custom", path: ["gender"], message: "Pick one" });
    }
  });

export const step2Schema = z
  .object({
    bsa_number: z
      .string()
      .trim()
      .max(20)
      .default("")
      .refine(
        (v) => v === "" || /^[A-Z0-9-]{3,20}$/.test(v),
        "BSA number: 3–20 chars, A–Z, 0–9, hyphen only",
      ),
    club_grading: z.union([z.enum(POSITIONS), z.literal("")]),
    dominant_hand: z.union([z.enum(HANDS), z.literal("")]),
  })
  .superRefine((data, ctx) => {
    if (data.club_grading === "") {
      ctx.addIssue({ code: "custom", path: ["club_grading"], message: "Pick a position" });
    }
    if (data.dominant_hand === "") {
      ctx.addIssue({ code: "custom", path: ["dominant_hand"], message: "Pick one" });
    }
  });

export const step3Schema = z.object({
  // email is rendered read-only from auth.user; not part of form state.
  phone: z.string().trim().max(40).default(""),
  email_opt_in: z.boolean().default(true),
});

export const step4Schema = z.object({
  agree_terms: z.boolean().refine((v) => v === true, "Required"),
  agree_privacy: z.boolean().refine((v) => v === true, "Required"),
});

export const setupSchema = z.object({
  identity: step1Schema,
  bowls: step2Schema,
  contact: step3Schema,
  consent: step4Schema,
});

export type SetupFormValues = z.infer<typeof setupSchema>;
export type SetupFormInput = z.input<typeof setupSchema>;

export const STEP_COUNT = 4;

export const STEP_KEYS = ["identity", "bowls", "contact", "consent"] as const;

export const STEP_LABELS: Record<(typeof STEP_KEYS)[number], string> = {
  identity: "Identity",
  bowls: "Bowls",
  contact: "Contact",
  consent: "Consent",
};

export const STEP_TRIGGERS: Record<number, readonly (keyof SetupFormValues)[]> = {
  1: ["identity"],
  2: ["bowls"],
  3: ["contact"],
  4: ["consent"],
};

// Build defaults from the user's existing profile row. acceptInviteAction
// has already populated first_name / last_name from the invite; the wizard
// surfaces those for confirmation/edit and asks for the rest.
export type ProfilePrefill = {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  gender: (typeof GENDERS)[number] | null;
  date_of_birth: string | null;
  bsa_number: string | null;
  dominant_hand: (typeof HANDS)[number] | null;
  phone: string | null;
  email_opt_in: boolean;
};

export function defaultsForProfile(p: ProfilePrefill): SetupFormInput {
  return {
    identity: {
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      display_name: p.display_name ?? "",
      gender: p.gender ?? "",
      date_of_birth: p.date_of_birth ?? "",
    },
    bowls: {
      bsa_number: p.bsa_number ?? "",
      club_grading: "",
      dominant_hand: p.dominant_hand ?? "",
    },
    contact: {
      phone: p.phone ?? "",
      email_opt_in: p.email_opt_in,
    },
    consent: {
      agree_terms: false,
      agree_privacy: false,
    },
  };
}
