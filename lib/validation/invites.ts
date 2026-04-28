import { z } from "zod";

const emailSchema = z.string().email().max(254);
const personNameSchema = z.string().min(1).max(80);

export const createInviteSchema = z.object({
  club_id: z.string().uuid(),
  email: emailSchema,
  role: z.enum(["club_admin", "player"]),
  first_name: personNameSchema.optional().nullable(),
  last_name: personNameSchema.optional().nullable(),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

// Batch player-invite payload. Same row shape as createInviteSchema minus
// the role discriminator (always 'player' for the batch RPC) and using
// nullable strings for first/last so jsonb serialization is symmetric with
// what the SQL function expects.
export const createPlayerInvitesBatchSchema = z.object({
  club_id: z.string().uuid(),
  invites: z
    .array(
      z.object({
        email: emailSchema,
        first_name: personNameSchema.optional().nullable(),
        last_name: personNameSchema.optional().nullable(),
      }),
    )
    .min(1, "At least one invite required")
    .max(100, "Maximum 100 invites per batch"),
});

export type CreatePlayerInvitesBatchInput = z.infer<typeof createPlayerInvitesBatchSchema>;
