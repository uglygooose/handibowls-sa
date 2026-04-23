import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/auth/role";

import { ClubsTable } from "./_components/ClubsTable";
import { listClubs } from "./_data";

const PAGE_SIZE = 50;

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function PlatformClubs({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(["super_admin"]);

  const sp = await searchParams;
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  const { rows, total } = await listClubs({ page, pageSize: PAGE_SIZE });

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Platform"
        title="Clubs"
        description="All registered clubs. Drill in to manage admins, greens, members, tournaments, and theme."
        actions={
          <Button asChild>
            <Link href="/platform/clubs/new">New club</Link>
          </Button>
        }
      />
      <div className="px-6 py-6">
        <ClubsTable
          rows={rows}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          basePath="/platform/clubs"
        />
      </div>
    </div>
  );
}
