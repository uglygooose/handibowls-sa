import Link from "next/link";

import { AuthAside } from "../_components/AuthAside";
import { AuthWordmark } from "../_components/AuthWordmark";
import { SignupForm } from "./signup-form";

export const metadata = {
  title: "Create account · HandiBowls",
};

export default function SignupPage() {
  return (
    <div
      data-theme="atomic-red"
      className="grid min-h-dvh bg-surface md:grid-cols-[1fr_1.1fr]"
    >
      <div className="mx-auto flex w-full max-w-[640px] flex-col px-5 py-8 md:px-12 md:py-8">
        <header className="mb-10 flex items-center justify-between md:mb-12">
          <AuthWordmark />
          <Link
            href="/"
            className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-muted hover:text-ink"
          >
            ← Back
          </Link>
        </header>

        <SignupForm />

        <footer className="mt-auto flex justify-between py-4 font-mono text-[11px] tracking-[0.1em] uppercase text-ink-subtle">
          <span>Private · RLS on</span>
          <span>© 2026 HandiBowls</span>
        </footer>
      </div>

      <AuthAside bowlPreset="ocean-blue" splatterPreset="ocean-blue" splatterVariant={0} side="right">
        <span className="block font-mono text-[10px] font-bold tracking-[0.16em] uppercase text-accent-ink">
          By the numbers
        </span>
        <div className="mt-3 grid grid-cols-2 gap-5">
          {[
            { n: "20+", l: "Clubs live" },
            { n: "5", l: "Districts" },
            { n: "4", l: "Formats" },
            { n: "<10m", l: "Setup time" },
          ].map((s) => (
            <div key={s.l} className="flex flex-col">
              <strong className="font-display text-[28px] font-black italic leading-none tracking-[-0.02em] text-ink">
                {s.n}
              </strong>
              <span className="mt-0.5 text-[10px] tracking-[0.12em] uppercase text-ink-subtle">
                {s.l}
              </span>
            </div>
          ))}
        </div>
      </AuthAside>
    </div>
  );
}
