import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/role";

import { AdminsTab } from "./_components/AdminsTab";
import { AuditTab } from "./_components/AuditTab";
import { ClubHero } from "./_components/ClubHero";
import { ClubTabs, TabPanel } from "./_components/ClubTabs";
import { isClubTab, type ClubTab } from "./_components/club-tabs-types";
import { DevInviteBanner } from "./_components/DevInviteBanner";
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
  const totalRinks = greens.reduce((s, g) => s + g.rink_count, 0);

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Link
              href="/platform/clubs"
              className="underline underline-offset-2 hover:text-ink"
            >
              Clubs
            </Link>
            <span aria-hidden>·</span>
            <span>{club.short_name ?? club.slug}</span>
          </span>
        }
        title={club.short_name ?? club.name}
        actions={
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/platform/clubs">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              All clubs
            </Link>
          </Button>
        }
      />
      <DevInviteBanner clubId={club.id} />
      <div className="mx-auto w-full max-w-[1440px] px-10 pt-8">
        <ClubHero
          themePreset={club.theme_preset}
          name={club.name}
          district={club.district_name}
          city={club.city}
          active={club.active}
          membersCount={counts.members}
          greensCount={counts.greens}
        />
      </div>
      <div className="mx-auto w-full max-w-[1440px] px-10">
        <ClubTabs active={active} />
        <TabPanel tab="overview" active={active}>
          <OverviewTab club={club} counts={counts} totalRinks={totalRinks} />
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
          <ThemeTab
            clubId={club.id}
            clubName={club.name}
            current={club.theme_preset}
          />
        </TabPanel>
        <TabPanel tab="audit" active={active}>
          <AuditTab />
        </TabPanel>
      </div>
    </div>
  );
}
