import {
  Button,
  Container,
  Heading,
  Hr,
  Section,
  Text,
} from "@react-email/components";

import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { BaseLayout } from "./_BaseLayout";

// Phase 11 / 11-1b — InviteEmail template.
//
// The only outbound email surface in v1. Sent at invite-creation
// time (Phase 11 / 11-4 wires this) when a club admin invites a
// player by email. Replaces the dev-only invite banner pattern
// flagged in DRIFT_LOG line 160.
//
// Audience
//
//   The recipient is an external person who is being asked to join
//   a club. They may not yet have a HandiBowls account; the CTA
//   link routes them through `/invite/[token]` which kicks off the
//   acceptance flow (Phase 5 / lib/invites/actions.ts). The 14-day
//   expiry is a hard gate — invites move to status='expired'
//   server-side via the default `now() + interval '14 days'` on
//   the invites row (migration 011).
//
// Theme handling
//
//   `themePreset` falls through to `core-black` when null/undefined
//   per the lookupInvite invariant. A future phase that wires per-
//   club theming for invite emails just passes the resolved preset
//   from `lookupInvite` -> `data.clubs?.theme_preset`.
//
// Composability
//
//   Wraps BaseLayout. Does NOT itself render `<Html>` / `<Body>` —
//   that's BaseLayout's job. Keeps the POPIA footer and speckle
//   header in one shared place.
//
// Out of scope
//
//   * Per-club sender override (`from`) — single global RESEND_FROM
//     in v1 per the locked decisions; reply-to override would be a
//     post-v1 polish item.
//   * Plain-text fallback — `@react-email/render`'s `plainText: true`
//     option auto-derives the text view; no separate authoring
//     needed.

export type InviteEmailProps = {
  /** Recipient's name if known (from invites.first_name + last_name).
   *  Falls back to "there" so the greeting reads cleanly when the
   *  invite row carries no name. */
  recipientName: string | null;
  /** Club the invite grants access to. */
  clubName: string;
  /** Display name of the club admin who created the invite. Falls
   *  back to "the club admin" when null. */
  invitedBy: string | null;
  /** Fully qualified accept URL — `${baseUrl}/invite/${token}`. The
   *  caller (createInvite, 11-4) builds this so this template never
   *  has to know about the path or token shape. */
  acceptUrl: string;
  /** Human-readable expiry, e.g. "14 May 2026". Pre-formatted by
   *  the caller via lib/format/dates so this template is locale-
   *  agnostic. */
  expiresOn: string;
  /** Active club preset for the brand strip. Null falls through to
   *  core-black per the project-wide DEFAULT_THEME invariant. */
  themePreset?: ThemePreset | null;
  /** Public origin used to build the unsubscribe link. */
  baseUrl: string;
  /** HMAC unsubscribe token from generateUnsubscribeToken(). */
  unsubscribeToken: string;
  /** Plain-text club address surfaced in the POPIA footer. */
  clubAddress?: string | null;
};

export function InviteEmail({
  recipientName,
  clubName,
  invitedBy,
  acceptUrl,
  expiresOn,
  themePreset,
  baseUrl,
  unsubscribeToken,
  clubAddress,
}: InviteEmailProps) {
  const greeting = `Hi ${recipientName ?? "there"},`;
  const inviter = invitedBy ?? "the club admin";
  const introLine = `${inviter} has invited you to join ${clubName} on HandiBowls.`;

  return (
    <BaseLayout
      themePreset={themePreset}
      kicker={`Invite · ${clubName}`.toUpperCase()}
      baseUrl={baseUrl}
      unsubscribeToken={unsubscribeToken}
      clubAddress={clubAddress}
      senderName={clubName}
    >
      <Container>
        <Heading style={STYLES.heading}>You&rsquo;re invited.</Heading>

        <Text style={STYLES.greeting}>{greeting}</Text>

        <Text style={STYLES.body}>{introLine}</Text>

        <Text style={STYLES.body}>
          HandiBowls is the bowls-first operating system for South African
          clubs &mdash; tournaments, scoring, bookings, and Twenty 20 skill
          assessments in one place.
        </Text>

        <Section style={STYLES.ctaSection}>
          <Button href={acceptUrl} style={STYLES.cta}>
            Accept invite
          </Button>
        </Section>

        <Text style={STYLES.expiry}>
          {`This invite expires on ${expiresOn} (14 days from when it was sent). After that you&rsquo;ll need a fresh invite from ${inviter}.`}
        </Text>

        <Hr style={STYLES.divider} />

        <Text style={STYLES.fallbackHint}>
          Button not working? Paste this link into your browser:
        </Text>
        <Text style={STYLES.fallbackUrl}>{acceptUrl}</Text>
      </Container>
    </BaseLayout>
  );
}

// PreviewProps — surfaces in the React Email dev server when
// previewing the template locally. Not used in production.
InviteEmail.PreviewProps = {
  recipientName: "James Thomas",
  clubName: "Demo Bowls Club",
  invitedBy: "Andrew Els",
  acceptUrl: "https://app.handibowls.app/invite/abc123def456",
  expiresOn: "14 May 2026",
  themePreset: "ocean-green",
  baseUrl: "https://app.handibowls.app",
  unsubscribeToken: "preview-token-payload.preview-token-sig",
  clubAddress: "Demo Bowls Club, 12 Speckle Lane, Cape Town",
} satisfies InviteEmailProps;

// ---------------------------------------------------------------------
// Inline styles (email-client safe)
// ---------------------------------------------------------------------

const STYLES = {
  heading: {
    fontFamily:
      "'Barlow Condensed', 'Oswald', Arial Black, Impact, sans-serif",
    fontSize: "36px",
    fontWeight: 900,
    fontStyle: "italic" as const,
    lineHeight: 1,
    letterSpacing: "-0.02em",
    color: "#0a0a0a",
    margin: "0 0 16px 0",
    textTransform: "uppercase" as const,
  },
  greeting: {
    fontSize: "15px",
    lineHeight: 1.5,
    color: "#0a0a0a",
    margin: "0 0 14px 0",
    fontWeight: 600,
  } as const,
  body: {
    fontSize: "15px",
    lineHeight: 1.55,
    color: "#0a0a0a",
    margin: "0 0 16px 0",
  } as const,
  ctaSection: {
    margin: "8px 0 24px 0",
  } as const,
  cta: {
    backgroundColor: "#0a0a0a",
    color: "#ffffff",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Arial, sans-serif",
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    textDecoration: "none" as const,
    padding: "14px 24px",
    borderRadius: "8px",
    display: "inline-block" as const,
  },
  expiry: {
    fontSize: "13px",
    lineHeight: 1.5,
    color: "#4a4a4a",
    margin: "0 0 8px 0",
  } as const,
  divider: {
    borderColor: "#e5e5e2",
    margin: "20px 0 16px 0",
  } as const,
  fallbackHint: {
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#7a7a7a",
    margin: "0 0 4px 0",
  } as const,
  fallbackUrl: {
    fontFamily:
      "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "11px",
    lineHeight: 1.4,
    color: "#0a0a0a",
    wordBreak: "break-all" as const,
    margin: 0,
  },
} as const;
