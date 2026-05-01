import { Download, Trophy } from "lucide-react";
import Link from "next/link";

import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { requireRole } from "@/lib/auth/role";

import { TournamentsList } from "./_components/TournamentsList";
import { getTournamentsForCurrentAdmin } from "./_data";

export default async function ManageTournamentsPage() {
  await requireRole(["club_admin", "super_admin"]);

  const [hostClub, tournaments] = await Promise.all([
    getCurrentHostClub(),
    getTournamentsForCurrentAdmin(),
  ]);
  const clubName = hostClub?.club_name ?? "your club";
  const splatterPreset = hostClub?.club_theme_preset ?? "atomic-red";

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
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
      <AdminPageHero
        eyebrow={`Club admin · ${clubName}`}
        title="Tournaments"
        description={subtitle}
        splatter={{ preset: splatterPreset, variant: 1, size: "L", rotate: -12, opacity: 0.6 }}
        speckle={{ seed: "hero-tournaments", density: "high", opacity: 0.06 }}
        actions={
          <>
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
          </>
        }
        containerWidth="none"
      />

      <TournamentsList tournaments={tournaments} clubName={clubName} />
    </div>
  );
}
