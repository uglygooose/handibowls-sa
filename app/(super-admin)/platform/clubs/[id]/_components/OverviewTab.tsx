import { Activity } from "lucide-react";

import type { ClubDetail } from "../_data";

type Props = {
  club: ClubDetail;
  counts: { admins: number; greens: number; members: number; tournaments: number };
  // Approximate "rinks total" — derived from greens.rink_count sum at the
  // page level. Surfaced here so the eyebrow under "Greens" can show the
  // total rinks (per design "12 rinks total").
  totalRinks?: number;
};

type StatCardProps = {
  eyebrow: string;
  value: string | number;
  trend?: string;
  trendTone?: "success" | "muted";
};

// Stat card per the Claude Design: mono uppercase eyebrow, 56px italic
// numeric, optional trend caption (success or muted).
function StatCard({ eyebrow, value, trend, trendTone = "success" }: StatCardProps) {
  return (
    <div className="rounded-[14px] border border-border bg-bone p-5">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-subtle">
        {eyebrow}
      </div>
      <div className="font-display text-[56px] font-black italic leading-none tracking-[-0.02em]">
        {value}
      </div>
      {trend && (
        <div
          className={
            trendTone === "success"
              ? "mt-1 text-xs font-semibold text-success-500"
              : "mt-1 text-xs font-semibold text-ink-subtle"
          }
        >
          {trend}
        </div>
      )}
    </div>
  );
}

export function OverviewTab({ club, counts, totalRinks }: Props) {
  // Last activity proxy: the design surfaces a "2h ago" relative timestamp
  // pulled from the (currently unbuilt) audit_log. Until that table lands
  // (Phase 12 — DRIFT_LOG entry), use clubs.updated_at as the closest live
  // signal so the stat is truthful rather than mocked.
  const lastUpdate = formatRelative(club.updated_at);
  const greensTrend =
    typeof totalRinks === "number"
      ? `${totalRinks} rink${totalRinks === 1 ? "" : "s"} total`
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          eyebrow="Members"
          value={counts.members}
          trend={counts.members > 0 ? `${counts.members} active` : "no members yet"}
          trendTone={counts.members > 0 ? "success" : "muted"}
        />
        <StatCard
          eyebrow="Greens"
          value={counts.greens}
          trend={greensTrend}
          trendTone="muted"
        />
        <StatCard
          eyebrow="Tournaments"
          value={counts.tournaments}
          trend={
            counts.tournaments > 0
              ? `${counts.tournaments} on file`
              : "none yet"
          }
          trendTone={counts.tournaments > 0 ? "success" : "muted"}
        />
        <StatCard
          eyebrow="Last update"
          value={lastUpdate}
          trend="Club row touched"
          trendTone="muted"
        />
      </div>

      {/* Activity feed empty state — the audit_log table doesn't exist yet
          (DRIFT_LOG → Phase 12). Truthful empty state until it lands. */}
      <div className="rounded-[14px] border border-border bg-bone">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4 font-display text-lg font-extrabold italic uppercase tracking-tight">
          Recent activity
        </div>
        <div className="px-5 py-12 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
            <Activity className="size-5" aria-hidden="true" />
          </div>
          <p className="m-0 text-sm font-medium text-ink">
            Activity feed lights up when audit logging ships.
          </p>
          <p className="mt-1 text-xs text-ink-subtle">
            Tournament publishes, theme changes, and member joins will all
            stream here once the audit_log table is in place.
          </p>
        </div>
      </div>
    </div>
  );
}

// Compact relative-time string: "2h ago", "3d ago", "12 Mar 2026". Used for
// the Last-update stat card. No external dep — date-fns is overkill for one
// formatter on this surface.
function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const ms = Date.now() - d.getTime();
  if (ms < 0) return "just now";
  const min = Math.floor(ms / 60000);
  if (min < 60) return min === 0 ? "just now" : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 14) return `${day}d ago`;
  return d.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
