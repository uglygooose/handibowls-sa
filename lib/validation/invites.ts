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
