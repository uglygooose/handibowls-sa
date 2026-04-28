import { Plus } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
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

  // Per-design eyebrow: "PLATFORM · N CLUBS" — surfaces the count inline.
  const eyebrow = `Platform · ${total} ${total === 1 ? "club" : "clubs"}`;

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow={eyebrow}
        title="Clubs"
        description="All clubs on the HandiBowls network."
        actions={
          <Button asChild size="xl">
            <Link href="/platform/clubs/new">
              <Plus className="size-4" aria-hidden="true" />
              New club
            </Link>
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-[1440px] px-10 py-8">
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
