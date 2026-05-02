import { AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";

import { BowlChip } from "@/components/brand/BowlChip";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import { THEME_PRESETS, type ThemePreset } from "@/components/brand/theme-presets";
import { Button } from "@/components/ui/button";
import { lookupInvite, type InviteLookupReason } from "@/lib/auth/actions";

import { AuthCard } from "../../_components/AuthCard";
import { AuthWordmark } from "../../_components/AuthWordmark";
import { InviteForm } from "./invite-form";

export const metadata = {
  title: "Accept invite · HandiBowls",
};

function asPreset(value: string | null | undefined): ThemePreset {
  if (value && (THEME_PRESETS as readonly string[]).includes(value)) {
    return value as ThemePreset;
  }
  return "core-black";
}

const REASON_COPY: Record<
  InviteLookupReason,
  { kicker: string; title: React.ReactNode; sub: string; icon: "danger" | "warn" }
> = {
  missing: {
    kicker: "03 · Invite not found",
    title: (
      <>
        Missing{" "}
        <em className="not-italic italic text-accent-ink">token.</em>
      </>
    ),
    sub: "This link doesn't include an invite token. Ask the club admin to resend it.",
    icon: "danger",
  },
  "not-found": {
    kicker: "03 · Invite not found",
    title: (
      <>
        We can&apos;t find that{" "}
        <em className="not-italic italic text-accent-ink">invite.</em>
      </>
    ),
    sub: "The link may be mistyped or the invite may have been cancelled.",
    icon: "danger",
  },
  used: {
    kicker: "03 · Already used",
    title: (
      <>
        This invite has been{" "}
        <em className="not-italic italic text-accent-ink">claimed.</em>
      </>
    ),
    sub: "If that was you, sign in below. If not, ask the club admin for a fresh invite.",
    icon: "warn",
  },
  expired: {
    kicker: "03 · Expired",
    title: (
      <>
        This invite has{" "}
        <em className="not-italic italic text-accent-ink">expired.</em>
      </>
    ),
    sub: "Invites last 14 days. Ask the club admin to issue another one.",
    icon: "warn",
  },
};

function InviteBackground({ preset }: { preset: ThemePreset }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute -top-20 -right-20 opacity-40">
        <SplatterAccent preset={preset} variant={0} size={460} rotate={-10} />
      </div>
      <div className="absolute -bottom-16 -left-10 opacity-35">
        <SplatterAccent preset="sunburst" variant={2} size={360} rotate={14} />
      </div>
    </div>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await lookupInvite(token);

  if (!invite.ok) {
    const copy = REASON_COPY[invite.reason];
    const Icon = copy.icon === "danger" ? AlertTriangle : Clock;
    const iconBg =
      copy.icon === "danger" ? "bg-danger-500" : "bg-warning-500";

    return (
      <div data-theme="core-black" className="relative min-h-dvh bg-surface">
        <InviteBackground preset="core-black" />
        <div className="relative z-[1] mx-auto flex min-h-dvh max-w-[720px] flex-col px-5 py-8 md:px-12 md:py-8">
          <header className="mb-10 flex items-center justify-between md:mb-12">
            <AuthWordmark />
            <Link
              href="/"
              className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-muted hover:text-ink"
            >
              ← Back
            </Link>
          </header>
          <div className="mx-auto w-full max-w-[560px]">
            <AuthCard
              kicker={copy.kicker}
              kickerTone="danger"
              title={copy.title}
              sub={copy.sub}
              className="text-center"
            >
              <div
                className={
                  "mx-auto mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full text-white " +
                  iconBg
                }
              >
                <Icon className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild size="lg">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/signup">Create account</Link>
                </Button>
              </div>
            </AuthCard>
          </div>
        </div>
      </div>
    );
  }

  const preset = asPreset(invite.clubThemePreset);

  return (
    <div data-theme={preset} className="relative min-h-dvh bg-surface">
      <InviteBackground preset={preset} />
      <div className="relative z-[1] mx-auto flex min-h-dvh max-w-[720px] flex-col px-5 py-8 md:px-12 md:py-8">
        <header className="mb-10 flex items-center justify-between md:mb-12">
          <AuthWordmark tag={`Invite · ${invite.clubName}`} />
          <Link
            href="/"
            className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-muted hover:text-ink"
          >
            ← Back
          </Link>
        </header>

        <div className="mx-auto w-full max-w-[560px]">
          <AuthCard
            kicker="03 · Accept invite"
            title={
              <>
                Welcome to{" "}
                <em className="not-italic italic text-accent-ink">
                  {invite.clubName}
                </em>
                .
              </>
            }
            sub={`You're joining as ${
              invite.role === "club_admin" ? "a club admin" : "a player"
            }. Set a password and you're on the green.`}
            foot={
              <>
                Wrong address?{" "}
                <Link
                  href="/"
                  className="font-semibold text-ink underline underline-offset-[3px] hover:text-accent-ink"
                >
                  Tell the admin
                </Link>
              </>
            }
          >
            <div className="mb-5 flex items-center gap-3.5 rounded-[14px] border border-border bg-surface-muted px-4 py-3.5">
              <BowlChip preset={preset} size={44} />
              <div className="flex-1 min-w-0">
                <div className="font-display text-[18px] font-extrabold italic leading-none tracking-[-0.01em] uppercase">
                  {invite.clubName}
                </div>
                <div className="mt-1 font-mono text-[12px] tracking-[0.04em] text-ink-subtle">
                  Home club · {preset.replace("-", " ")}
                </div>
              </div>
              <div className="text-right">
                <span className="block font-mono text-[9px] tracking-[0.16em] uppercase text-ink-subtle">
                  Role
                </span>
                <strong className="font-display text-[14px] font-extrabold italic tracking-[0.02em]">
                  {invite.role === "club_admin" ? "Club admin" : "Player"}
                </strong>
              </div>
            </div>

            <InviteForm token={token} email={invite.email} />
          </AuthCard>
        </div>

        <footer className="mt-auto flex justify-between py-4 font-mono text-[11px] tracking-[0.1em] uppercase text-ink-subtle">
          <span>Secure · Token bound</span>
          <span>© 2026 HandiBowls</span>
        </footer>
      </div>
    </div>
  );
}
