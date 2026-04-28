import { ChevronLeft, Mail } from "lucide-react";
import Link from "next/link";

import { SpeckleLayer } from "@/components/brand/SpeckleLayer";

// /payments — placeholder per Phase 7 plan §10.6 + locked decision
// "no payment integration in v1". Linked from the entry-fee placeholder
// in /manage/tournaments/new and from the command palette (when it
// surfaces print/payment items down the line).
//
// Public route — no role gate. Anyone clicking the entry-fee link
// from a logged-out (player) entry page lands here too.

export default function PaymentsPage() {
  return (
    <div className="min-h-dvh bg-bone">
      <div className="relative mx-auto max-w-3xl px-6 py-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-48">
          <SpeckleLayer
            seed="payments-hero"
            density="med"
            opacity={0.06}
          />
        </div>

        <div className="relative z-10 flex flex-col gap-8">
          <Link
            href="/"
            className="inline-flex h-7 w-fit items-center gap-1 rounded-md px-1.5 text-[13px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Back to HandiBowls
          </Link>

          <div className="flex flex-col gap-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Payments · v2 roadmap
            </span>
            <h1 className="font-display text-[48px] font-black italic leading-none tracking-tight">
              Payment collection coming soon.
            </h1>
            <p className="max-w-[60ch] text-[14px] text-ink-muted">
              HandiBowls displays entry fees on the entry page so admins
              and entrants know what&apos;s expected, but we don&apos;t yet
              process payments through the platform. v1 ships with the
              tournament engine, draws, and scoring; payments arrive
              alongside the broader club-billing rollout.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-surface px-6 py-6">
            <h2 className="font-display text-2xl font-black tracking-tight">
              What we&apos;re evaluating
            </h2>
            <ul className="mt-4 flex flex-col gap-3 text-[14px]">
              <Option
                provider="Peach Payments"
                summary="South-Africa-first, EFT + card, established BSA-club integrations elsewhere."
              />
              <Option
                provider="Yoco"
                summary="Local cards + soft tap-to-pay; well-known to club treasurers."
              />
              <Option
                provider="Stripe"
                summary="International cards; useful for districts running cross-border events."
              />
            </ul>
          </div>

          <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-5 text-[13px] text-ink-muted">
            <p className="mb-3">
              We&apos;re collecting feedback from clubs running real
              tournaments before locking in a provider. If your club has
              specific banking constraints (FNB, Standard Bank, ABSA,
              Nedbank, Capitec) or a preferred payment workflow, let us
              know — it&apos;ll shape what ships.
            </p>
            <a
              href="mailto:hello@handibowls.app"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 font-medium text-ink hover:bg-surface-muted"
            >
              <Mail className="size-3.5" aria-hidden="true" />
              hello@handibowls.app
            </a>
          </div>

          <p className="text-center font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            v1 ships without payment processing — by design.
          </p>
        </div>
      </div>
    </div>
  );
}

function Option({
  provider,
  summary,
}: {
  provider: string;
  summary: string;
}) {
  return (
    <li className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface px-4 py-3">
      <strong className="font-display text-[15px] tracking-tight">
        {provider}
      </strong>
      <span className="text-[13px] text-ink-muted">{summary}</span>
    </li>
  );
}
