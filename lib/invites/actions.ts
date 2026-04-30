"use server";

import { getAuthContext } from "@/lib/auth/role";
import { sendInviteEmail } from "@/lib/invites/email";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createInviteSchema,
  createPlayerInvitesBatchSchema,
  type CreateInviteInput,
  type CreatePlayerInvitesBatchInput,
} from "@/lib/validation/invites";

/** Email-side outcome of an invite-creation flow. The invite row is
 *  always written; the email send is best-effort. Callers surface
 *  this in the UI so admins know whether they need to resend.
 *
 *  Variants:
 *    sent      Resend accepted the email; recipient should receive it.
 *    failed    Resend rejected the send (domain not verified,
 *              transient outage, validation error, etc.). Admin
 *              should copy the URL or retry later.
 *    skipped   Email send was deliberately not attempted. Two
 *              reasons share this status today:
 *                opted_out: existing profile has email_opt_in=false
 *                           (11-6 POPIA gate)
 *                duplicate: createPlayerInvitesBatch row was a
 *                           duplicate of an existing invite — the
 *                           original already covered the recipient
 *  Drilling into the reason requires reading the action's email_error
 *  prefix (it carries either an opt-out marker or a Resend error). */
export type InviteEmailStatus = "sent" | "failed" | "skipped";

export type CreateInviteResult =
  | {
      ok: true;
      data: {
        invite_id: string;
        token: string;
        email_status: InviteEmailStatus;
        email_error?: string;
      };
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export type BatchInviteResultRow = {
  email: string;
  status: "created" | "duplicate";
  invite_id: string | null;
  token: string | null;
  /** Only populated when status='created'. Duplicates don't re-trigger
   *  email sends — the original invite already covered them. */
  email_status: InviteEmailStatus;
  email_error?: string;
};

export type CreatePlayerInvitesBatchResult =
  | { ok: true; data: BatchInviteResultRow[] }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// Single source of truth for invite creation. Two call sites:
//   • assignClubAdmin (super-admin only) → role='club_admin'
//   • SingleInviteModal on /manage/members (club_admin owning the club, or
//     super_admin) → role='player'
// The gate accepts super_admin unconditionally; club_admin only when the
// target club_id appears in their JWT-derived current_club_ids() claim,
// resolved via getAuthContext()'s readClaimsFromJwt path.
//
// The DB write goes through the service client because RLS on `invites` is
// scoped to the invitee's email — the inviter is not the recipient, so the
// authed insert + select would round-trip through RLS twice. Service client
// is correct here for the same reason it is in the Phase-4 createClub flow.
export async function createInvite(
  input: CreateInviteInput,
): Promise<CreateInviteResult> {
  const parsed = createInviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const v = parsed.data;

  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: "Not authenticated." };
  const allowed =
    ctx.role === "super_admin" ||
    (ctx.role === "club_admin" && ctx.clubIds.includes(v.club_id));
  if (!allowed) return { ok: false, error: "Not authorized to invite to this club." };

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("invites")
    .insert({
      club_id: v.club_id,
      email: v.email.toLowerCase(),
      role: v.role,
      first_name: v.first_name ?? null,
      last_name: v.last_name ?? null,
      invited_by: ctx.userId,
    })
    .select("id, token")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create invite." };
  }

  // Phase 11 / 11-4a — fire the InviteEmail. Failures are
  // non-blocking: the invite row is already written, so the admin
  // can resend later from the membership UI. Pass the inviter's
  // email as a stable identity hint; the helper resolves the full
  // display name itself.
  // 11-6: 'skipped' covers the POPIA opt-out path (existing profile
  // with email_opt_in=false). The row still persists; UI surfaces
  // a "this user has opted out" message rather than "failed".
  const emailResult = await sendInviteEmail({
    token: data.token,
    invitedByDisplayName: ctx.email,
  });
  return {
    ok: true,
    data: {
      invite_id: data.id,
      token: data.token,
      email_status: emailResult.status,
      email_error: emailResultToError(emailResult),
    },
  };
}

// Batch player-invite creation. Defense-in-depth: re-check the role-aware gate
// here before delegating to the SECURITY DEFINER RPC (which has its own gate).
// The RPC is atomic and idempotent — see migration 018 for details.
export async function createPlayerInvitesBatch(
  input: CreatePlayerInvitesBatchInput,
): Promise<CreatePlayerInvitesBatchResult> {
  const parsed = createPlayerInvitesBatchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const v = parsed.data;

  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: "Not authenticated." };
  const allowed =
    ctx.role === "super_admin" ||
    (ctx.role === "club_admin" && ctx.clubIds.includes(v.club_id));
  if (!allowed) return { ok: false, error: "Not authorized to invite to this club." };

  // Use the authed server client so the RPC's internal current_role() and
  // current_club_ids() resolve to the calling user. The RPC body is
  // SECURITY DEFINER but the auth checks read the caller's JWT.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_player_invites_batch", {
    p_club_id: v.club_id,
    p_invites: v.invites.map((i) => ({
      email: i.email,
      first_name: i.first_name ?? null,
      last_name: i.last_name ?? null,
    })),
  });

  if (error) return { ok: false, error: error.message };

  // Phase 11 / 11-4a — fan out InviteEmails for the freshly
  // CREATED rows only. Duplicates don't re-trigger sends — the
  // original invite already covered them. Sequential sends keep
  // ordering predictable; if an admin imports a 200-row CSV the
  // last user shouldn't get their email before the first. Resend's
  // SDK supports concurrent calls but the action layer doesn't
  // need that throughput in v1.
  const rows: BatchInviteResultRow[] = [];
  for (const r of data ?? []) {
    const status = (r.status as "created" | "duplicate") ?? "duplicate";
    if (status === "duplicate" || !r.token) {
      rows.push({
        email: r.email ?? "",
        status,
        invite_id: r.invite_id,
        token: r.token,
        email_status: "skipped",
      });
      continue;
    }
    const emailResult = await sendInviteEmail({
      token: r.token,
      invitedByDisplayName: ctx.email,
    });
    rows.push({
      email: r.email ?? "",
      status,
      invite_id: r.invite_id,
      token: r.token,
      email_status: emailResult.status,
      email_error: emailResultToError(emailResult),
    });
  }
  return { ok: true, data: rows };
}

// ---------------------------------------------------------------------
// Result mapping helpers
// ---------------------------------------------------------------------
//
// Surfaces a one-line marker for the UI's email_error field that
// distinguishes "opted out" from a real Resend failure. Skipped
// results are not errors per se but the field is the cheapest place
// to thread the reason through the action boundary without expanding
// the result-row shape.

function emailResultToError(
  result: Awaited<ReturnType<typeof sendInviteEmail>>,
): string | undefined {
  if (result.status === "sent") return undefined;
  if (result.status === "failed") return result.error;
  // skipped — surface the reason as a stable marker the UI can branch on.
  return `opted_out:${result.reason}`;
}
