import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/role";

import { TournamentHero } from "./_components/TournamentHero";
import { TournamentTabs, parseTabFromUrl, type TabId } from "./_components/TournamentTabs";
import { AuditTab } from "./_components/tabs/AuditTab";
import { CommsTab } from "./_components/tabs/CommsTab";
import { DrawTab } from "./_components/tabs/DrawTab";
import { EntriesTab } from "./_components/tabs/EntriesTab";
import { RinksTab } from "./_components/tabs/RinksTab";
import { ScoringTab } from "./_components/tabs/ScoringTab";
import { getTournamentDetail, getTournamentEntries } from "./_data";

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

  // Fetch entries only for the entries tab — saves the round-trip on
  // tabs that don't consume them. Phase 7c-ii's draw / 7c-iii's scoring
  // will fetch matches via similar tab-conditional queries.
  const entries = tab === "entries" ? await getTournamentEntries(id) : [];

  const badges = {
    entries: tournament.entries_count,
    scoring: tournament.matches_open + tournament.matches_in_progress,
  } as const;

  return (
    <div className="flex flex-col gap-6 px-8 py-6">
      <TournamentHero tournament={tournament} />
      <TournamentTabs active={tab} badges={badges} />
      <div className="pt-2">
        {tab === "entries" && <EntriesTab entries={entries} />}
        {tab === "draw" && <DrawTab />}
        {tab === "scoring" && <ScoringTab />}
        {tab === "rinks" && <RinksTab />}
        {tab === "comms" && <CommsTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </div>
  );
}
