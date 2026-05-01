import Link from "next/link";

import { AdminPageHero } from "@/components/layout/AdminPageHero";

import { AuditLogPanel } from "./_components/AuditLogPanel";
import { BookingsCalendarGrid } from "./_components/BookingsCalendarGrid";
import { getBookingsForWeek, getRecentAuditLogForClub } from "./_data";
import { parseWeekParam } from "./week";

// Phase 9-2/9-3 — `/manage/overview` Bookings tab. Replaces the Phase 4 stub.
//
// Reads `?w=YYYY-MM-DD` (snapped to Monday by parseWeekParam), resolves
// the host club via getCurrentHostClub, and renders the weekly calendar
// + recent audit-log panel for that club. super_admin lands without a
// host club → empty card pointing at /platform/clubs (mirrors the
// /manage/greens precedent).
//
// The audit panel sits below the calendar so the admin sees their
// just-cancelled booking appear in the trail without navigating away.
// Both data fetchers run in parallel (no inter-dependency).

export const metadata = {
  title: "Overview · HandiBowls",
};

type SearchParams = { w?: string };

export default async function ManageOverview({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const mondayIso = parseWeekParam(params.w);
  const data = await getBookingsForWeek(mondayIso);
  const auditData = data.ok
    ? await getRecentAuditLogForClub(data.clubId)
    : null;

  if (!data.ok) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 pb-24">
        <AdminPageHero eyebrow="Club admin" title="Overview" containerWidth="none" />
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-ink-muted">
            No club is in scope for this account. Use{" "}
            <Link
              href="/platform/clubs"
              className="font-medium text-ink underline"
            >
              Platform · Clubs
            </Link>{" "}
            to pick a club to manage.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 pb-24">
      <AdminPageHero
        eyebrow={`Club admin · ${data.clubName}`}
        title="Overview"
        description="Weekly bookings calendar. Tap a chip to view details or force-cancel on a member's behalf — every cancel writes an audit-log entry."
        containerWidth="none"
      />

      <BookingsCalendarGrid
        bookings={data.bookings}
        mondayIso={data.mondayIso}
        clubName={data.clubName}
      />

      <AuditLogPanel
        rows={auditData?.ok ? auditData.rows : []}
        errored={auditData ? !auditData.ok : false}
      />
    </div>
  );
}
