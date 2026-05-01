import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { requireRole } from "@/lib/auth/role";

import { ClubsSearchBar } from "./_components/ClubsSearchBar";
import { ClubsTable } from "./_components/ClubsTable";
import { listClubs } from "./_data";

const PAGE_SIZE = 50;
const BASE_PATH = "/platform/clubs";

type SearchParams = { [key: string]: string | string[] | undefined };

function readParam(sp: SearchParams, key: string): string {
  const v = sp[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function PlatformClubs({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(["super_admin"]);

  const sp = await searchParams;
  const q = readParam(sp, "q");
  const page = Math.max(1, Number.parseInt(readParam(sp, "page") || "1", 10) || 1);

  const { rows, total } = await listClubs({ q, page, pageSize: PAGE_SIZE });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
      <AdminPageHero
        eyebrow="Platform"
        title="Clubs"
        description="All registered clubs. Drill in to manage admins, greens, members, tournaments, and theme."
        actions={
          <Button asChild>
            <Link href="/platform/clubs/new">New club</Link>
          </Button>
        }
        containerWidth="none"
      />
      <ClubsSearchBar initialQuery={q} basePath={BASE_PATH} />
      <ClubsTable
        rows={rows}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        q={q}
        basePath={BASE_PATH}
      />
    </div>
  );
}
