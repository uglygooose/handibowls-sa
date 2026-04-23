import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  kicker?: ReactNode;
  kickerTone?: "default" | "danger";
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  foot?: ReactNode;
  className?: string;
};

// Card frame used by every auth surface. Ships its own primary-coloured
// drop shadow so the card reads as a decisive CTA island over the speckle
// surface behind it.
export function AuthCard({
  kicker,
  kickerTone = "default",
  title,
  sub,
  children,
  foot,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "mb-8 flex-1 rounded-3xl border-2 border-ink bg-bone p-7 md:p-10",
        className,
      )}
      style={{ boxShadow: "10px 12px 0 var(--color-primary-500)" }}
    >
      {kicker && (
        <div
          className={cn(
            "mb-3.5 inline-flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.16em] uppercase",
            kickerTone === "danger" ? "text-danger-500" : "text-ink-subtle",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              kickerTone === "danger" ? "bg-danger-500" : "bg-primary-500",
            )}
          />
          {kicker}
        </div>
      )}
      <h1 className="m-0 mb-3 font-display text-[clamp(36px,4.2vw,52px)] font-black italic leading-[0.95] tracking-[-0.02em] uppercase text-balance">
        {title}
      </h1>
      {sub && <p className="m-0 mb-6 text-[15px] text-ink-muted">{sub}</p>}
      {children}
      {foot && (
        <div className="mt-5 text-center text-sm text-ink-muted">{foot}</div>
      )}
    </div>
  );
}
