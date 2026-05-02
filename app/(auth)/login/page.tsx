import Link from "next/link";

import type { ThemePreset } from "@/components/brand/ThemeApplier";

import { AuthAside } from "../_components/AuthAside";
import { AuthWordmark } from "../_components/AuthWordmark";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in · HandiBowls",
};

const BOWL_ROTATION: ThemePreset[] = [
  "ruby",
  "ocean-green",
  "grape",
  "sunburst",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; sent?: string; invited_to?: string }>;
}) {
  const { next, sent, invited_to: invitedTo } = await searchParams;
  // Rotate the aside bowl by day-of-year so the preview feels alive without
  // breaking SSR hydration.
  const now = new Date();
  const dayOfYear = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      Date.UTC(now.getUTCFullYear(), 0, 0)) /
      (1000 * 60 * 60 * 24),
  );
  const asidePreset = BOWL_ROTATION[dayOfYear % BOWL_ROTATION.length];

  return (
    <div
      data-theme="atomic-red"
      className="grid min-h-dvh bg-surface md:grid-cols-[1.1fr_1fr]"
    >
      <AuthAside bowlPreset={asidePreset} splatterPreset={asidePreset} splatterVariant={1}>
        <span className="block font-mono text-[10px] font-bold tracking-[0.16em] uppercase text-accent-ink">
          From the green
        </span>
        <p className="mt-2.5 mb-4 font-display text-[22px] font-extrabold italic leading-[1.1] tracking-[-0.01em] uppercase">
          The shot always comes back to the hand that drew it.
          <em className="mt-2 block font-sans text-[15px] font-bold italic normal-case tracking-normal text-accent-ink">
            — old skip&apos;s proverb
          </em>
        </p>
      </AuthAside>

      <main className="mx-auto flex w-full max-w-[640px] flex-col px-5 py-8 md:px-12 md:py-8">
        <header className="mb-10 flex items-center justify-between md:mb-12">
          <AuthWordmark />
          <Link
            href="/"
            className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-muted hover:text-ink"
          >
            ← Back
          </Link>
        </header>

        {invitedTo && (
          <div
            data-slot="login-invited-banner"
            role="status"
            className="mb-6 rounded-xl border border-primary-500/30 bg-primary-500/8 px-4 py-3 text-sm"
          >
            <div className="font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-accent-ink">
              Invite accepted
            </div>
            <p className="mt-0.5 text-[13px] text-ink">
              You&rsquo;ve been added to <strong>{invitedTo}</strong>. Sign in
              with your existing HandiBowls credentials to access the new club.
            </p>
          </div>
        )}

        <LoginForm next={next ?? ""} initialMagicLinkSent={sent === "1"} />

        <footer className="mt-auto flex justify-between py-4 font-mono text-[11px] tracking-[0.1em] uppercase text-ink-subtle">
          <span>Secure · RLS on</span>
          <span>© 2026 HandiBowls</span>
        </footer>
      </main>
    </div>
  );
}
