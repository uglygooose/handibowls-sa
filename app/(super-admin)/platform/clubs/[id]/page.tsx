import Link from "next/link";
import { notFound } from "next/navigation";

import { BowlChip } from "@/components/brand/BowlChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/auth/role";

import { AdminsTab } from "./_components/AdminsTab";
import { AuditTab } from "./_components/AuditTab";
import { ClubTabs, TabPanel } from "./_components/ClubTabs";
import { isClubTab, type ClubTab } from "./_components/club-tabs-types";
import { GreensTab } from "./_components/GreensTab";
import { MembersTab } from "./_components/MembersTab";
import { OverviewTab } from "./_components/OverviewTab";
import { ThemeTab } from "./_components/ThemeTab";
import { TournamentsTab } from "./_components/TournamentsTab";
import {
  getClubAdmins,
  getClubDetail,
  getClubGreens,
  getClubMembers,
  getClubTournaments,
} from "./_data";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function ClubDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(["super_admin"]);

  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const raw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const active: ClubTab = isClubTab(raw) ? raw : "overview";

  const club = await getClubDetail(id);
  if (!club) notFound();

  const [admins, greens, members, tournaments] = await Promise.all([
    getClubAdmins(id),
    getClubGreens(id),
    getClubMembers(id),
    getClubTournaments(id),
  ]);

  const counts = {
    admins: admins.length,
    greens: greens.length,
    members: members.length,
    tournaments: tournaments.length,
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <Link href="/platform/clubs" className="hover:underline">
              Clubs
            </Link>
            <span aria-hidden>/</span>
            <span>{club.slug}</span>
          </span>
        }
        title={
          <span className="flex items-center gap-3">
            <BowlChip preset={club.theme_preset} size={32} />
            <span>{club.name}</span>
            <Badge variant={club.active ? "default" : "outline"}>
              {club.active ? "Active" : "Archived"}
            </Badge>
          </span>
        }
        description={
          <span>
            {club.district_name ?? "—"} · {club.city}
          </span>
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/platform/clubs">Back to list</Link>
          </Button>
        }
      />
      <ClubTabs active={active} />
      <TabPanel tab="overview" active={active}>
        <OverviewTab club={club} counts={counts} />
      </TabPanel>
      <TabPanel tab="admins" active={active}>
        <AdminsTab admins={admins} />
      </TabPanel>
      <TabPanel tab="greens" active={active}>
        <GreensTab greens={greens} />
      </TabPanel>
      <TabPanel tab="members" active={active}>
        <MembersTab members={members} />
      </TabPanel>
      <TabPanel tab="tournaments" active={active}>
        <TournamentsTab tournaments={tournaments} />
      </TabPanel>
      <TabPanel tab="theme" active={active}>
        <ThemeTab clubId={club.id} clubName={club.name} current={club.theme_preset} />
      </TabPanel>
      <TabPanel tab="audit" active={active}>
        <AuditTab />
      </TabPanel>
    </div>
  );
}
