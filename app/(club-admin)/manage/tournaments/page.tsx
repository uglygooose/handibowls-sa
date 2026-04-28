import { Download, Trophy } from "lucide-react";
import Link from "next/link";

import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import { getCurrentMemberships } from "@/lib/auth/memberships";
import { requireRole } from "@/lib/auth/role";

import { TournamentsList } from "./_components/TournamentsList";
import { getTournamentsForCurrentAdmin } from "./_data";

export default async function ManageTournamentsPage() {
  await requireRole(["club_admin", "super_admin"]);

  const [memberships, tournaments] = await Promise.all([
    getCurrentMemberships(),
    getTournamentsForCurrentAdmin(),
  ]);
  const primary =
    memberships.find((m) => m.is_primary) ?? memberships[0] ?? null;
  const clubName = primary?.club_name ?? "your club";
  const splatterPreset = primary?.club_theme_preset ?? "atomic-red";

  // Subtitle text — dynamic count, BSA-canonical phrasing. Avoids the
  // design's hardcoded "Five active competitions across four formats" so
  // the surface stays accurate across empty / partial / full states.
  const activeCount = tournaments.filter(
    (t) => t.status === "open" || t.status === "in_progress",
  ).length;
  const formatCount = new Set(tournaments.map((t) => t.format)).size;
  const subtitle =
    tournaments.length === 0
      ? `Run knockouts, drawn sets, and tournaments at ${clubName}. Create your first one to get started.`
      : `Run knockouts, drawn sets, and tournaments at ${clubName}. ${activeCount} active ${activeCount === 1 ? "competition" : "competitions"} across ${formatCount} ${formatCount === 1 ? "format" : "formats"}.`;

  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      {/* Page hero — speckle backing + corner splatter accent. */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface px-8 py-7">
        <div className="pointer-events-none absolute inset-0 z-0">
          <SpeckleLayer
            seed="hero-tournaments"
            density="high"
            opacity={0.06}
          />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-10 z-0 opacity-[0.6]"
        >
          <SplatterAccent
            preset={splatterPreset}
            variant={1}
            size={300}
            rotate={-12}
          />
        </div>

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Club Admin · {clubName}
            </div>
            <h1 className="mt-1.5 font-display text-[44px] font-black italic leading-[1.05] tracking-tight">
              Tournaments
            </h1>
            <p className="mt-2 max-w-[58ch] text-[14px] text-ink-muted">
              {subtitle}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </button>
            <Link
              href="/manage/tournaments/new"
              className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary-500 px-5 text-sm font-semibold text-[color:var(--color-on-primary)] shadow-sm hover:bg-primary-600"
            >
              <Trophy className="size-4" aria-hidden="true" />
              New Tournament
            </Link>
          </div>
        </div>
      </div>

      <TournamentsList tournaments={tournaments} clubName={clubName} />
    </div>
  );
}
