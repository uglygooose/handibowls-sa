import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/auth/role";

import { UsersSearchBar } from "./_components/UsersSearchBar";
import { UsersTable } from "./_components/UsersTable";
import { listUsers } from "./_data";

const PAGE_SIZE = 50;
const BASE_PATH = "/platform/users";

type SearchParams = { [key: string]: string | string[] | undefined };

function readParam(sp: SearchParams, key: string): string {
  const v = sp[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function PlatformUsers({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(["super_admin"]);

  const sp = await searchParams;
  const q = readParam(sp, "q");
  const page = Math.max(1, Number.parseInt(readParam(sp, "page") || "1", 10) || 1);

  const { rows, total } = await listUsers({ q, page, pageSize: PAGE_SIZE });

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Platform"
        title="Users"
        description="Search across all profiles by name, email, or club. Read-only."
      />
      <div className="flex flex-col gap-4 px-6 py-6">
        <UsersSearchBar initialQuery={q} basePath={BASE_PATH} />
        <UsersTable
          rows={rows}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          q={q}
          basePath={BASE_PATH}
        />
      </div>
    </div>
  );
}
