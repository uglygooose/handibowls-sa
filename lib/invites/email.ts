import "server-only";

import { headers } from "next/headers";
import { render } from "@react-email/render";

import { sendEmail } from "@/lib/email/client";
import { generateUnsubscribeToken } from "@/lib/email/unsubscribe";
import { InviteEmail } from "@/lib/email/templates/InviteEmail";
import { formatDateZA } from "@/lib/format/dates";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database.types";

// Phase 11 / 11-4a — sendInviteEmail helper (opt-out gate added 11-6).
//
// Single source of truth for "an invite row was just written →
// render + send the InviteEmail." Three invite-creation surfaces
// share this helper:
//
//   • lib/invites/actions.ts createInvite
//   • lib/invites/actions.ts createPlayerInvitesBatch
//   • app/(super-admin)/platform/clubs/_actions.ts createClub
//     (admin invite created atomically by create_club_with_dependencies)
//
// Failure semantics
//
//   Email failures DO NOT roll back the invite row. The row is the
//   record of authority; the email is best-effort. The action's
//   result returns an emailStatus discriminator so the UI can
//   surface "couldn't email — please copy/share the URL or
//   resend" without the admin losing the row. Mirrors the locked
//   decision in 11-4 brief.
//
// POPIA opt-out gate (11-6)
//
//   When the recipient has an existing HandiBowls profile AND
//   profiles.email_opt_in === false, the email is NOT sent — the
//   invite row still persists so the admin can copy/share the URL
//   manually. The action result surfaces { status: 'skipped',
//   reason: 'opted_out' } so the UI can render an actionable
//   "this user has opted out" message rather than a misleading
//   "sent" or "failed". For new emails (no profile yet), opt-out
//   doesn't apply — the recipient hasn't had a chance to opt out
//   of anything, and an invite is a one-shot pre-relationship
//   communication that POPIA permits.
//
// Unsubscribe token binding
//
//   Every outbound email carries an unsubscribe link per the 11-1
//   BaseLayout contract. For invite recipients we look up an
//   existing profile by email and bind the token to that
//   profileId when present. When the recipient has no profile yet
//   (the typical first-invite case), we bind to the invite_id —
//   the token is HMAC-valid but `verifyUnsubscribeToken` will
//   resolve to no profile, so the unsubscribe page falls through
//   to the generic invalid-link card.
//
// Out of scope (for 11-4a)
//
//   • Resend webhook telemetry — dropped from Phase 11 entirely.
//   • Per-club Resend sender override — single global RESEND_FROM
//     in v1 per locked decision #4.

export type SendInviteEmailInput = {
  /** Token from the invites row — used to construct the accept URL
   *  and as a fallback unsubscribe-token subject when the recipient
   *  has no existing profile. */
  token: string;
  /** Optional pre-resolved invited-by display name. Saves a profile
   *  lookup in callers (assignClubAdmin, the wizard) that already
   *  have the inviter's identity in scope. Falls back to a profile
   *  lookup when omitted; falls back to "the club admin" when no
   *  name is resolvable. */
  invitedByDisplayName?: string | null;
  /** Optional override for the public origin used in the accept +
   *  unsubscribe URLs. Defaults to the request origin via headers()
   *  (works in any Server Action context); falls back to env. */
  baseUrl?: string;
};

export type SendInviteEmailResult =
  | { status: "sent"; emailId: string }
  | { status: "skipped"; reason: SendInviteEmailSkipReason }
  | { status: "failed"; reason: SendInviteEmailFailureReason; error: string };

export type SendInviteEmailFailureReason =
  | "invite_not_found"
  | "club_not_found"
  | "render_failed"
  | "send_failed";

export type SendInviteEmailSkipReason =
  /** Existing HandiBowls profile has email_opt_in=false. POPIA
   *  honoured: invite row persists, email send skipped, admin can
   *  copy/share the accept URL manually. */
  | "opted_out";

export async function sendInviteEmail(
  input: SendInviteEmailInput,
): Promise<SendInviteEmailResult> {
  const admin = createServiceClient();

  // 1. Read the invite row authoritatively (service-role; RLS would
  //    block since the inviter isn't the recipient).
  const { data: invite, error: inviteErr } = await admin
    .from("invites")
    .select(
      "id, club_id, email, role, first_name, last_name, expires_at, invited_by, clubs(name, theme_preset, contact_email, city)",
    )
    .eq("token", input.token)
    .maybeSingle();

  if (inviteErr || !invite) {
    // No invite row to attribute the failure to — caller's only
    // option is to surface the error from the result.
    return {
      status: "failed",
      reason: "invite_not_found",
      error: inviteErr?.message ?? "Invite row not found for token.",
    };
  }

  const inviteId = invite.id;
  const recordStatus = async (result: SendInviteEmailResult): Promise<SendInviteEmailResult> => {
    // Persist the latest send-attempt outcome onto the invite row
    // (migration 040). Status codes mirror the discriminated union;
    // failure error text gets surfaced inline so the admin's Resend
    // UI can preview the last failure cause without a separate fetch.
    const status = result.status;
    const errorText = result.status === "failed" ? result.error : null;
    const { error: persistErr } = await admin
      .from("invites")
      .update({
        email_status: status,
        email_error: errorText,
        email_sent_at: new Date().toISOString(),
      })
      .eq("id", inviteId);
    if (persistErr) {
      // Persistence failure is non-fatal — the original send result
      // is still authoritative for the caller. Log and move on.
      console.error("[invites] email_status persist failed:", persistErr);
    }
    return result;
  };

  const club = invite.clubs as
    | {
        name?: string;
        theme_preset?: string | null;
        contact_email?: string | null;
        city?: string | null;
      }
    | null;
  if (!club || !club.name) {
    return recordStatus({
      status: "failed",
      reason: "club_not_found",
      error: "Club row missing for this invite.",
    });
  }

  // 2. Resolve the inviter's display name (optional; falls through
  //    cleanly to "the club admin" inside the template).
  let invitedByName = input.invitedByDisplayName ?? null;
  if (invitedByName === undefined || invitedByName === null) {
    invitedByName = await resolveInviterName(invite.invited_by);
  }

  // 3. Resolve unsubscribe token's profileId AND opt-out state in
  //    one round-trip. Existing profile + email_opt_in=false →
  //    skip the send entirely (POPIA opt-out honoured at fan-out
  //    per 11-6 compliance sweep). New email (no profile) →
  //    bind the token to invite.id and proceed.
  const recipient = await resolveProfileForRecipient(invite.email);
  if (recipient && recipient.email_opt_in === false) {
    return recordStatus({ status: "skipped", reason: "opted_out" });
  }
  const tokenSubjectId = recipient?.id ?? invite.id;

  // 4. Build URLs.
  const baseUrl = input.baseUrl ?? (await resolveBaseUrl());
  const acceptUrl = `${baseUrl}/invite/${input.token}`;
  const unsubscribeToken = await generateUnsubscribeToken({
    profileId: tokenSubjectId,
    clubId: invite.club_id,
  });

  // 5. Render template.
  const recipientName = composeName(invite.first_name, invite.last_name);
  const themePreset = (club.theme_preset ?? "core-black") as
    | NonNullable<Database["public"]["Enums"]["club_theme_preset"]>
    | "core-black";
  const expiresOn = formatDateZA(invite.expires_at);
  const clubAddress = club.city ? `${club.name}, ${club.city}` : club.name;

  let html: string;
  let text: string;
  try {
    [html, text] = await Promise.all([
      render(
        InviteEmail({
          recipientName,
          clubName: club.name,
          invitedBy: invitedByName,
          acceptUrl,
          expiresOn,
          themePreset,
          baseUrl,
          unsubscribeToken,
          clubAddress,
        }),
      ),
      render(
        InviteEmail({
          recipientName,
          clubName: club.name,
          invitedBy: invitedByName,
          acceptUrl,
          expiresOn,
          themePreset,
          baseUrl,
          unsubscribeToken,
          clubAddress,
        }),
        { plainText: true, htmlToTextOptions: { wordwrap: 80 } },
      ),
    ]);
  } catch (e) {
    return recordStatus({
      status: "failed",
      reason: "render_failed",
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // 6. Send.
  const subject = `You're invited to join ${club.name} on HandiBowls`;
  const result = await sendEmail({
    to: invite.email,
    subject,
    html,
    text,
    replyTo: club.contact_email ?? undefined,
  });

  if (!result.ok) {
    return recordStatus({
      status: "failed",
      reason: "send_failed",
      error: result.error,
    });
  }

  return recordStatus({ status: "sent", emailId: result.id });
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

async function resolveInviterName(invitedBy: string | null): Promise<string | null> {
  if (!invitedBy) return null;
  const admin = createServiceClient();
  const { data } = await admin
    .from("profiles")
    .select("display_name, first_name, last_name")
    .eq("id", invitedBy)
    .maybeSingle();
  if (!data) return null;
  if (data.display_name) return data.display_name;
  return composeName(data.first_name, data.last_name);
}

async function resolveProfileForRecipient(
  email: string,
): Promise<{ id: string; email_opt_in: boolean } | null> {
  const admin = createServiceClient();
  const { data } = await admin
    .from("profiles")
    .select("id, email_opt_in")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, email_opt_in: data.email_opt_in };
}

function composeName(
  first: string | null | undefined,
  last: string | null | undefined,
): string | null {
  const composed = [first, last].filter(Boolean).join(" ").trim();
  return composed.length > 0 ? composed : null;
}

async function resolveBaseUrl(): Promise<string> {
  // Mirrors lib/auth/actions.ts siteUrl(): prefer the request-bound
  // origin, fall back to env, fall back to localhost.
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() is only available inside a request context — tests
    // and any background-job callers fall through to env.
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  );
}
