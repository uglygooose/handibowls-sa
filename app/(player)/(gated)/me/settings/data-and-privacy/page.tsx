import { ChevronLeft, Download } from "lucide-react";
import Link from "next/link";

import { PlayerSectionHead } from "@/components/layout/PlayerSectionHead";

import { DeleteAccountCard } from "./_components/DeleteAccountCard";

// Phase 13 / 13-2b / Batch H2 — POPIA data-and-privacy sub-route.
//
// Hosts two affordances:
//   1. "Download my data"  → GET /api/me/export (Batch G2). Browser
//                            handles the Content-Disposition response;
//                            no client JS needed for the download
//                            itself.
//   2. "Delete account"    → AlertDialog confirmation → calls
//                            requestAccountDeletion server action
//                            (Batch G1). On success, redirects to
//                            /me with a soft-deleted state visible
//                            via the (player)(gated) layout's
//                            grace-window banner.
//
// Sub-route placement per scoping § 5 (Option A — mirror the
// existing /me/inbox sub-route pattern). Settings stub at /me's
// "Account" row deep-links here.

export const metadata = {
  title: "Data & privacy",
  description: "Export your data or delete your account.",
};

export default function DataAndPrivacyPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-4 pb-24">
      <Link
        href="/me"
        className="inline-flex items-center gap-1 self-start text-[13px] text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back to profile
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[28px] font-black italic leading-tight tracking-tight">
          Data &amp; privacy
        </h1>
        <p className="text-[14px] text-ink-muted">
          Export your data or delete your account. Your data export is
          a complete copy of every record we hold about you. Account
          deletion is final after a 30-day grace window — you can
          restore the account by signing in any time during the
          window. For the full disclosure of how we collect and
          handle your data, read our{" "}
          <Link
            href="/privacy"
            className="font-medium text-ink underline underline-offset-[3px] decoration-border hover:decoration-ink"
          >
            privacy policy
          </Link>
          .
        </p>
      </header>

      <PlayerSectionHead>Export my data</PlayerSectionHead>
      <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[18px] font-bold tracking-tight">
            Download a copy
          </h2>
          <p className="text-[13.5px] text-ink-muted">
            We&rsquo;ll generate a JSON file containing your profile,
            consents, club memberships, tournament entries, match
            history, T20 assessments, bookings, messages,
            notifications, and audit-log entries. The file is safe
            to keep — it contains only data tied to your account.
          </p>
        </div>
        {/* Native <a download> triggers the Content-Disposition
            attachment response from /api/me/export. No client JS
            needed; browser handles the file save. */}
        <a
          href="/api/me/export"
          download
          className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-[14px] bg-ink px-5 text-[13.5px] font-bold uppercase tracking-[0.04em] text-ink-inverse hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
          data-slot="export-data-link"
        >
          <Download className="size-4" aria-hidden="true" />
          Download my data
        </a>
      </section>

      <PlayerSectionHead>Delete my account</PlayerSectionHead>
      <DeleteAccountCard />
    </div>
  );
}
