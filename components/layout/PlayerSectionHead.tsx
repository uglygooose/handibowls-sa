import type { ReactNode } from "react";

import Link from "next/link";

import { cn } from "@/lib/utils";

// Phase 12.5 / 12.5-6.5 Stage C — shared player section-head
// primitive. Consolidates 5+ local `SectionHead` definitions
// across player surfaces (/play, /me, /t20, /t20/[assessmentId],
// /tournaments/[id]) that all rendered different sizes (13 / 18 /
// 20 px) — diverging from the design source bundle's
// `.section-head h3` rule (player-styles.css:297-302):
//
//   .section-head {
//     display: flex;
//     align-items: baseline;
//     justify-content: space-between;
//     margin: 22px 0 10px;
//   }
//   .section-head h3 {
//     font-size: 22px;
//     text-transform: uppercase;
//     font-style: italic;
//   }
//   .section-head a {
//     font-family: 'JetBrains Mono', monospace;
//     font-size: 11px;
//     color: var(--primary-500);
//     font-weight: 700;
//     letter-spacing: 0.06em;
//     text-transform: uppercase;
//   }
//
// Optional `action` prop renders an inline "View all" link on the
// right (matches `.section-head a` styling). When omitted, the h3
// fills the row.

type ActionProp =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

type Props = {
  /** Required — the section heading content. Renders as an h3 per
   *  bundle markup (h2 if the consumer needs to control heading
   *  level — overridable via `as` prop below). */
  children: ReactNode;
  /** Heading level. Defaults to "h3" per bundle. Use "h2" only when
   *  the section needs to outrank a sibling. Doesn't change visual
   *  size — that's locked at 22px. */
  as?: "h2" | "h3";
  /** Optional inline-right "View all" link / action. Renders mono
   *  11px primary-500 uppercase per bundle's `.section-head a`. */
  action?: ActionProp;
  /** Optional caption rendered on the right INSTEAD of an action
   *  link. Used when there's a small status string (e.g. "3 OPEN")
   *  rather than a navigable link. */
  caption?: ReactNode;
  className?: string;
};

export function PlayerSectionHead({
  children,
  as = "h3",
  action,
  caption,
  className,
}: Props) {
  const Heading = as;
  return (
    <div
      data-slot="player-section-head"
      className={cn(
        "mt-[22px] mb-[10px] flex items-baseline justify-between gap-3",
        className,
      )}
    >
      <Heading
        data-slot="player-section-head-title"
        className="font-display text-[22px] font-black italic uppercase leading-tight tracking-tight"
      >
        {children}
      </Heading>
      {action ? (
        action.href ? (
          <Link
            href={action.href}
            data-slot="player-section-head-action"
            className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-accent-ink hover:underline"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            data-slot="player-section-head-action"
            className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-accent-ink hover:underline"
          >
            {action.label}
          </button>
        )
      ) : caption ? (
        <span
          data-slot="player-section-head-caption"
          className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted"
        >
          {caption}
        </span>
      ) : null}
    </div>
  );
}
