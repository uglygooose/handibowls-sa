import { ChevronLeft, Mail, Target } from "lucide-react";
import Link from "next/link";

import { SpeckleLayer } from "@/components/brand/SpeckleLayer";

// /t20 — Phase 10 stub. The PlayerBottomNav surfaces a T20 tab in
// Phase 8 because the design source ships 5 tabs in the final
// treatment, but the T20 module (assessments, grade ladder, club
// hosts) lands in Phase 10. Mirrors the /payments stub pattern from
// Phase 7d: a public, themed roadmap card so the tab navigates
// somewhere intentional rather than 404-ing.

export default function T20Page() {
  return (
    <div className="relative min-h-dvh bg-bone">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-48">
        <SpeckleLayer seed="t20-hero" density="med" opacity={0.06} />
      </div>

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col gap-8 px-5 py-10">
        <Link
          href="/play"
          className="inline-flex h-7 w-fit items-center gap-1 rounded-md px-1.5 text-[13px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Back home
        </Link>

        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            T20 grading · Phase 10 roadmap
          </span>
          <h1 className="font-display text-[40px] font-black italic leading-[0.95] tracking-tight">
            T20 hub coming soon.
          </h1>
          <p className="max-w-[60ch] text-[14px] text-ink-muted">
            The T20 module is the official Bowls South Africa handicap and
            grading system — Bronze, Silver, Gold, Platinum — with seasonal
            re-assessments hosted by clubs. v1 ships with the tournament
            engine + player surfaces; T20 lands alongside a dedicated
            assessment workflow and the historical grading view.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface px-6 py-6">
          <h2 className="flex items-center gap-2 font-display text-xl font-black tracking-tight">
            <Target className="size-4 text-primary-500" aria-hidden="true" />
            What lands in Phase 10
          </h2>
          <ul className="mt-4 flex flex-col gap-3 text-[14px]">
            <Item title="Your grade ladder" body="Track Bronze → Platinum progression with the date earned and 12-month validity window." />
            <Item title="Upcoming assessments" body="See open assessment slots at your primary club + cross-club bookings via T20-host clubs in the same district." />
            <Item title="Compass capture" body="The 8-zone, 4-grade T20 assessment compass — the same rubric your club admin uses." />
          </ul>
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-5 text-[13px] text-ink-muted">
          <p className="mb-3">
            Want to be told when the T20 module lands? Email us and we&apos;ll
            ping you when assessments open at your club.
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
          v1 ships without T20 — by design.
        </p>
      </div>
    </div>
  );
}

function Item({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface px-4 py-3">
      <strong className="font-display text-[15px] tracking-tight">{title}</strong>
      <span className="text-[13px] text-ink-muted">{body}</span>
    </li>
  );
}
