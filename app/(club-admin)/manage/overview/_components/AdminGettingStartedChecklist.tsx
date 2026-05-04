import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import type { OnboardingChecklistState } from "../_data";

// Phase 13 / 13-6 / Batch C — admin getting-started checklist on
// /manage/overview. Each item's checked state is derived from real
// data via getOnboardingChecklistState; there is no manual dismissal.
// All five complete → collapses to a one-line "Setup complete" strip
// rather than disappearing, so admins keep a positive end-state
// affordance and don't read the missing card as a regression.

type ItemKey = keyof OnboardingChecklistState;

const ITEMS: ReadonlyArray<{
  key: ItemKey;
  label: string;
  helper: string;
  href: string;
  cta: string;
}> = [
  {
    key: "hasGreensAndRinks",
    label: "Set up your club's greens and rinks",
    helper: "Add at least one green with an active rink so members can book.",
    href: "/manage/greens",
    cta: "Greens & rinks",
  },
  {
    key: "hasInvitedMember",
    label: "Invite at least one other member",
    helper: "A club of one isn't very social. Invite someone you trust first.",
    href: "/manage/members",
    cta: "Members",
  },
  {
    key: "hasBookingAvailability",
    label: "Set weekly booking availability",
    helper: "Decide which days and time blocks each green is open for booking.",
    href: "/manage/greens",
    cta: "Weekly availability",
  },
  {
    key: "hasFirstTournament",
    label: "Create your first tournament",
    helper: "A draft is fine — you can publish and open entries when ready.",
    href: "/manage/tournaments/new",
    cta: "New tournament",
  },
  {
    key: "hasFirstMessage",
    label: "Send your first message",
    helper: "Test the messaging surface — broadcast or pick a small audience.",
    href: "/manage/messages/new",
    cta: "New message",
  },
];

export function AdminGettingStartedChecklist({
  state,
}: {
  state: OnboardingChecklistState;
}) {
  const completedCount = ITEMS.filter((i) => state[i.key]).length;
  const total = ITEMS.length;

  if (completedCount === total) {
    return (
      <section
        data-slot="getting-started-checklist"
        data-state="complete"
        className="flex items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3 text-[13px]"
      >
        <CheckCircle2 className="size-4 shrink-0 text-success-500" aria-hidden="true" />
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">
          Setup complete
        </span>
        <span className="text-ink-muted">All five getting-started steps done.</span>
      </section>
    );
  }

  return (
    <section
      data-slot="getting-started-checklist"
      data-state="in-progress"
      className="flex flex-col gap-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-subtle">
            Getting started
          </p>
          <h2 className="font-display text-[18px] font-black uppercase italic tracking-tight">
            Set up your club
          </h2>
        </div>
        <span
          data-slot="checklist-progress"
          className="font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-muted"
        >
          {completedCount} of {total} complete
        </span>
      </header>

      <ol
        data-slot="checklist-items"
        className="overflow-hidden rounded-[14px] border border-border bg-surface"
      >
        {ITEMS.map((item, idx) => {
          const checked = state[item.key];
          return (
            <li
              key={item.key}
              data-slot="checklist-item"
              data-item-key={item.key}
              data-checked={checked ? "true" : "false"}
              className={cn(
                "flex items-start gap-3 px-4 py-3.5",
                idx > 0 && "border-t border-border",
              )}
            >
              {checked ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-500" aria-label="Complete" />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-ink-subtle" aria-label="Not yet complete" />
              )}
              <div className="flex flex-1 flex-col gap-0.5">
                <p className={cn("text-[14px] font-semibold", checked && "text-ink-muted line-through")}>
                  {item.label}
                </p>
                <p className="text-[12.5px] text-ink-muted">{item.helper}</p>
              </div>
              <Link
                href={item.href}
                data-slot="checklist-item-cta"
                className="ml-auto inline-flex shrink-0 items-center gap-1 self-center rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-surface-muted"
              >
                {item.cta}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
