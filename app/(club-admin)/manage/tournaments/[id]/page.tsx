import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/role";

import { TournamentHero } from "./_components/TournamentHero";
import { parseTabFromUrl, type TabId } from "./_components/tabs";
import { TournamentTabs } from "./_components/TournamentTabs";
import { AuditTab } from "./_components/tabs/AuditTab";
import { CommsTab } from "./_components/tabs/CommsTab";
import { DrawTab } from "./_components/tabs/DrawTab";
import { EntriesTab } from "./_components/tabs/EntriesTab";
import { RinksTab } from "./_components/tabs/RinksTab";
import { ScoringTab } from "./_components/tabs/ScoringTab";
import {
  getMatchesForTournament,
  getTournamentDetail,
  getTournamentEntries,
} from "./_data";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TournamentDetailPage({
  params,
  searchParams,
}: Props) {
  await requireRole(["club_admin", "super_admin"]);
  const { id } = await params;
  const sp = await searchParams;
  const tab: TabId = parseTabFromUrl(
    typeof sp.tab === "string" ? sp.tab : undefined,
  );

  const tournament = await getTournamentDetail(id);
  if (!tournament) notFound();

  // Tab-conditional fetches — only pull what the active tab needs.
  //   * entries tab uses its own query
  //   * draw + scoring + rinks all consume the matches query so we
  //     fetch it once when any is active
  //   * comms + audit don't need extra DB hits today
  const entries = tab === "entries" ? await getTournamentEntries(id) : [];
  const matches =
    tab === "draw" || tab === "scoring" || tab === "rinks"
      ? await getMatchesForTournament(id)
      : [];

  // Current round = highest round_no with any non-final match, or the
  // highest round_no overall if everything's done.
  const roundsWithOpen = matches
    .filter((m) => m.status !== "completed" && m.status !== "cancelled")
    .map((m) => m.round ?? 0);
  const allRounds = matches.map((m) => m.round ?? 0).filter((r) => r > 0);
  const currentRound = roundsWithOpen.length
    ? Math.min(...roundsWithOpen)
    : allRounds.length
      ? Math.max(...allRounds)
      : null;

  const badges = {
    entries: tournament.entries_count,
    scoring: tournament.matches_open + tournament.matches_in_progress,
  } as const;

  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      <TournamentHero tournament={tournament} />
      <TournamentTabs active={tab} badges={badges} />
      {/* Phase 13 / 13-1 / commit 6: each tab content is wrapped in
          <section role="tabpanel"> with id+aria-labelledby pointing at
          its TournamentTabs button. Closes axe `aria-required-parent`
          warnings + makes the tab→panel relationship discoverable to
          screen readers. */}
      <section
        role="tabpanel"
        id={`tabpanel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="pt-2"
        tabIndex={0}
      >
        {tab === "entries" && <EntriesTab entries={entries} />}
        {tab === "draw" && (
          <DrawTab
            tournamentId={tournament.id}
            matches={matches}
            decorPreset={tournament.host_club.theme_preset}
            currentRound={currentRound}
          />
        )}
        {tab === "scoring" && (
          <ScoringTab
            tournamentId={tournament.id}
            matches={matches}
            shotsTarget={tournament.shots_up_target}
            endsTarget={tournament.ends_per_match}
          />
        )}
        {tab === "rinks" && <RinksTab matches={matches} />}
        {tab === "comms" && <CommsTab tournament={tournament} />}
        {tab === "audit" && <AuditTab />}
      </section>
    </div>
  );
}
