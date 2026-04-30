import {
  Body,
  Container,
  Hr,
  Html,
  Link,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

import { PRESET_BY_ID } from "@/lib/brand/presets";
import type { ThemePreset } from "@/components/brand/ThemeApplier";

// Phase 11 / 11-1 — shared HandiBowls email shell.
//
// The five Phase-11 templates (GenericBroadcast, InviteEmail,
// TournamentAnnouncement, MatchReminder, BookingReminder) all wrap
// their body in this layout. It owns three things:
//
//   1. The brand header strip — solid theme-primary block with a
//      mono kicker line on top of a tiny inline speckle SVG.
//   2. The body container — bone bg, 600px max width, 24px padding.
//   3. The mandatory POPIA footer — sender display name + optional
//      club address + unsubscribe link. Required on every Resend
//      send per plan §14 step 6.
//
// Theme fallback
//
//   `themePreset` defaults to `"core-black"` when omitted or null.
//   This matches the project-wide invariant
//   (lib/brand/theme-from-user.ts: DEFAULT_THEME = "core-black"):
//   unauthenticated, super-admin, and "club has no preset"
//   surfaces all fall through to Core Black, never Atomic Red.
//
// Why inline styles, not Tailwind
//
//   Email clients vary wildly in CSS support. Inline-only is the
//   most defensive baseline. The user's 11-1 brief locked the
//   primitive list (Html / Body / Container / Section / Heading /
//   Text / Button / Hr / Link) — `<Tailwind>` is excluded from
//   that list, so we go inline.
//
// Speckle SVG
//
//   A static deterministic 600×8px strip rendered inline. Six dots
//   in `--speckle-a` and four in `--speckle-b`, hand-positioned so
//   the visual reads as "scattered, not random". Email clients
//   that strip SVG (older Outlook desktop clients) just see the
//   solid header strip behind it — graceful degrade.

export type BaseLayoutProps = {
  /** Active club's theme preset. `null` / `undefined` falls back to
   *  `core-black` per project-wide DEFAULT_THEME invariant. */
  themePreset?: ThemePreset | null;
  /** Mono kicker rendered above the headline inside the header
   *  strip. Conventionally the message kind in caps (e.g.
   *  "TOURNAMENT ANNOUNCEMENT", "MATCH REMINDER"). */
  kicker: string;
  /** Public origin used to build the unsubscribe URL — the email
   *  itself ships this so test snapshots are deterministic and
   *  staging vs prod don't share links. */
  baseUrl: string;
  /** HMAC token from `generateUnsubscribeToken`. Required — every
   *  outbound email carries an unsubscribe link per POPIA. */
  unsubscribeToken: string;
  /** Optional plain-text club address rendered above the
   *  unsubscribe link. POPIA §69 requires a physical address on
   *  marketing comms. */
  clubAddress?: string | null;
  /** Sender display name. Conventionally the club name; falls back
   *  to "HandiBowls" so the footer reads cleanly even on
   *  platform-level emails (e.g. invite acceptance). */
  senderName?: string;
  children: ReactNode;
};

export function BaseLayout({
  themePreset,
  kicker,
  baseUrl,
  unsubscribeToken,
  clubAddress,
  senderName,
  children,
}: BaseLayoutProps) {
  const preset = PRESET_BY_ID[themePreset ?? "core-black"];
  const unsubscribeUrl = `${baseUrl}/email/unsubscribe?t=${encodeURIComponent(unsubscribeToken)}`;
  const sender = senderName ?? "HandiBowls";

  return (
    <Html lang="en">
      <Body style={STYLES.body}>
        <Container style={STYLES.outerContainer}>
          {/* Header strip — solid theme primary + speckle SVG underlay */}
          <Section style={{ ...STYLES.header, backgroundColor: preset.base }}>
            <SpeckleStrip a={preset.speckle[0]} b={preset.speckle[1]} />
            <div style={{ ...STYLES.kicker, color: preset.on }}>{kicker}</div>
          </Section>

          {/* Body */}
          <Container style={STYLES.bodyContainer}>{children}</Container>

          {/* Footer */}
          <Hr style={STYLES.footerHr} />
          <Section style={STYLES.footerSection}>
            <Text style={STYLES.footerSenderText}>
              {`Sent by ${sender} via HandiBowls.`}
            </Text>
            {clubAddress ? (
              <Text style={STYLES.footerAddressText}>{clubAddress}</Text>
            ) : null}
            <Text style={STYLES.footerUnsubscribeText}>
              You can&nbsp;
              <Link href={unsubscribeUrl} style={STYLES.unsubscribeLink}>
                unsubscribe from these emails
              </Link>
              &nbsp;at any time. We respect your inbox — POPIA-compliant.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------
// Speckle SVG — static 600×8 strip with two-colour scatter
// ---------------------------------------------------------------------

function SpeckleStrip({ a, b }: { a: string; b: string }) {
  // Hand-positioned dots — designed to read as "intentional scatter"
  // rather than mathematical regularity. Coordinates pinned for
  // snapshot determinism.
  const dotsA = [
    { cx: 32, cy: 4, r: 1.6 },
    { cx: 124, cy: 5, r: 1.2 },
    { cx: 218, cy: 3, r: 1.8 },
    { cx: 312, cy: 5, r: 1.4 },
    { cx: 416, cy: 4, r: 1.6 },
    { cx: 524, cy: 5, r: 1.2 },
  ];
  const dotsB = [
    { cx: 78, cy: 5, r: 1.0 },
    { cx: 268, cy: 4, r: 1.2 },
    { cx: 360, cy: 6, r: 1.0 },
    { cx: 472, cy: 4, r: 1.0 },
  ];
  return (
    <div style={STYLES.speckleWrap}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="600"
        height="8"
        viewBox="0 0 600 8"
        aria-hidden="true"
        style={STYLES.speckleSvg}
      >
        {dotsA.map((d, i) => (
          <circle key={`a${i}`} cx={d.cx} cy={d.cy} r={d.r} fill={a} />
        ))}
        {dotsB.map((d, i) => (
          <circle key={`b${i}`} cx={d.cx} cy={d.cy} r={d.r} fill={b} />
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------
// Inline styles
// ---------------------------------------------------------------------

const STYLES = {
  body: {
    backgroundColor: "#f1f0ec",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Arial, sans-serif",
    margin: 0,
    padding: 0,
  } as const,
  outerContainer: {
    width: "100%",
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
  } as const,
  header: {
    position: "relative" as const,
    padding: "32px 32px 28px 32px",
    overflow: "hidden" as const,
  },
  speckleWrap: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    lineHeight: 0,
    opacity: 0.65,
  },
  speckleSvg: {
    display: "block" as const,
    width: "100%",
    height: 8,
  },
  kicker: {
    fontFamily:
      "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    margin: 0,
  },
  bodyContainer: {
    padding: "28px 32px 24px 32px",
    color: "#0a0a0a",
    fontSize: "15px",
    lineHeight: 1.55,
  } as const,
  footerHr: {
    borderColor: "#e5e5e2",
    margin: "0 32px",
  } as const,
  footerSection: {
    padding: "20px 32px 28px 32px",
    color: "#7a7a7a",
    fontSize: "12px",
    lineHeight: 1.5,
  } as const,
  footerSenderText: {
    margin: "0 0 6px 0",
    color: "#4a4a4a",
    fontSize: "12px",
  } as const,
  footerAddressText: {
    margin: "0 0 8px 0",
    color: "#7a7a7a",
    fontSize: "11px",
    fontStyle: "italic" as const,
  },
  footerUnsubscribeText: {
    margin: 0,
    color: "#7a7a7a",
    fontSize: "11px",
  } as const,
  unsubscribeLink: {
    color: "#0a0a0a",
    textDecoration: "underline" as const,
  },
} as const;
