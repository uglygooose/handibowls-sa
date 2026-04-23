import { z } from "zod";

import { THEME_PRESETS } from "@/components/brand/theme-presets";

// Mirrors the club_theme_preset Postgres enum. Kept in sync with the 9-preset
// set declared in components/brand/ThemeApplier.tsx and migration 001.
export const themePresetSchema = z.enum(THEME_PRESETS);

export const clubSlugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, digits, and hyphens");

const emailSchema = z.string().email().max(254);

// Matches the greens.rink_count CHECK (1..12) and the rinks.number range.
const greenInputSchema = z.object({
  name: z.string().min(1).max(80),
  rink_count: z.number().int().min(1).max(12),
});

// Input for the super-admin create-club wizard. Shape mirrors the
// create_club_with_dependencies RPC's parameter list.
export const createClubInputSchema = z.object({
  name: z.string().min(1).max(120),
  short_name: z.string().max(20).optional().nullable(),
  slug: clubSlugSchema,
  district_id: z.string().uuid(),
  city: z.string().min(1).max(80),
  contact_email: emailSchema.optional().nullable(),
  contact_phone: z.string().max(40).optional().nullable(),
  logo_path: z.string().max(255).optional().nullable(),
  theme_preset: themePresetSchema,
  admin_email: emailSchema,
  greens: z.array(greenInputSchema).min(1).max(10),
  player_emails: z.array(emailSchema).max(100).default([]),
});

export type CreateClubInput = z.infer<typeof createClubInputSchema>;

export const updateClubThemeSchema = z.object({
  club_id: z.string().uuid(),
  theme_preset: themePresetSchema,
});

export type UpdateClubThemeInput = z.infer<typeof updateClubThemeSchema>;

export const assignClubAdminSchema = z.object({
  club_id: z.string().uuid(),
  email: emailSchema,
});

export type AssignClubAdminInput = z.infer<typeof assignClubAdminSchema>;

export const createInviteSchema = z.object({
  club_id: z.string().uuid(),
  email: emailSchema,
  role: z.enum(["club_admin", "player"]),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
