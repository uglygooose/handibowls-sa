import Link from "next/link";
import { notFound } from "next/navigation";

import { BowlChip } from "@/components/brand/BowlChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/auth/role";

import {
  ClubTabs,
  isClubTab,
  TabPanel,
  type ClubTab,
} from "./_components/ClubTabs";
import { getClubDetail } from "./_data";

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
        <div className="text-sm text-ink-muted">Overview — populated in the next commit.</div>
      </TabPanel>
      <TabPanel tab="admins" active={active}>
        <div className="text-sm text-ink-muted">Admins — populated in the next commit.</div>
      </TabPanel>
      <TabPanel tab="greens" active={active}>
        <div className="text-sm text-ink-muted">Greens — populated in the next commit.</div>
      </TabPanel>
      <TabPanel tab="members" active={active}>
        <div className="text-sm text-ink-muted">Members — populated in the next commit.</div>
      </TabPanel>
      <TabPanel tab="tournaments" active={active}>
        <div className="text-sm text-ink-muted">Tournaments — populated in the next commit.</div>
      </TabPanel>
      <TabPanel tab="theme" active={active}>
        <div className="text-sm text-ink-muted">Theme — populated in a later commit.</div>
      </TabPanel>
      <TabPanel tab="audit" active={active}>
        <div className="text-sm text-ink-muted">Audit — populated in the next commit.</div>
      </TabPanel>
    </div>
  );
}
