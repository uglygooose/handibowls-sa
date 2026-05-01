import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Phase 12.5 / 12.5-1 (audit id `empty-state-primitive`): the canonical
// shared empty-state primitive. Replaces the ad-hoc empty-state
// patterns scattered across rubrics / t20 list / messages Sent / future
// tournaments / members surfaces.
//
// Visual contract per audit:
//   - centred column, max-width 320px on the body copy
//   - optional 56px lucide icon, ink-muted
//   - mono uppercase eyebrow (11px / 0.14em — uses the .eyebrow
//     utility from app/globals.css)
//   - display headline (24px, font-display 900 italic)
//   - body copy 15px ink-muted
//   - primary CTA + optional secondary ghost
//   - default `variant="bone"` on bone background; `variant="on-surface"`
//     drops the surface-tinted card chrome for nesting in already-tinted
//     contexts (e.g. inside a `<TabsContent>` that's already on bone)
//
// Use: <EmptyState
//        icon={Inbox}
//        eyebrow="No assessments yet"
//        title="Capture your first Twenty 20"
//        body="Pick a player, run them through the 7 sections, sign off."
//        primaryCta={{ label: "New assessment", href: "/manage/t20/new" }}
//      />

type CtaProps =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

type EmptyStateProps = {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  body?: string;
  primaryCta?: CtaProps;
  secondaryCta?: CtaProps;
  /**
   * Visual context. `"bone"` (default) ships the dashed-border card on a
   * bone background — use at top-level or in card-spaced layouts.
   * `"on-surface"` drops the card chrome — use when the parent already
   * supplies a surface (e.g. inside a `<TabsContent>` already on bone).
   */
  variant?: "bone" | "on-surface";
  className?: string;
};

export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  body,
  primaryCta,
  secondaryCta,
  variant = "bone",
  className,
}: EmptyStateProps) {
  const wrap =
    variant === "bone"
      ? "rounded-[14px] border border-dashed border-border bg-bone px-6 py-10"
      : "px-6 py-10";

  return (
    <section
      data-slot="empty-state"
      data-variant={variant}
      className={cn("flex flex-col items-center text-center", wrap, className)}
    >
      {Icon ? (
        <Icon
          aria-hidden="true"
          className="mb-4 size-14 stroke-[1.75] text-ink-muted"
        />
      ) : null}
      {eyebrow ? <span className="eyebrow mb-2">{eyebrow}</span> : null}
      <h3 className="m-0 font-display text-[24px] font-black italic leading-[1.1] tracking-tight">
        {title}
      </h3>
      {body ? (
        <p className="mt-2 max-w-[320px] text-[15px] leading-[1.5] text-ink-muted">
          {body}
        </p>
      ) : null}
      {primaryCta || secondaryCta ? (
        <div
          data-slot="empty-state-ctas"
          className="mt-5 flex flex-wrap items-center justify-center gap-2"
        >
          {primaryCta ? <Cta variant="primary" cta={primaryCta} /> : null}
          {secondaryCta ? <Cta variant="ghost" cta={secondaryCta} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function Cta({
  variant,
  cta,
}: {
  variant: "primary" | "ghost";
  cta: CtaProps;
}) {
  if ("href" in cta && cta.href != null) {
    return (
      <Button asChild variant={variant} size="md">
        <Link href={cta.href}>{cta.label}</Link>
      </Button>
    );
  }
  return (
    <Button variant={variant} size="md" onClick={cta.onClick}>
      {cta.label}
    </Button>
  );
}
