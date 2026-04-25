import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/auth/role";

import { DistrictsTable } from "./_components/DistrictsTable";
import { listDistrictsWithClubCount } from "./_data";

export default async function PlatformDistricts() {
  await requireRole(["super_admin"]);

  const rows = await listDistrictsWithClubCount();

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Platform"
        title="Districts"
        description="Bowls South Africa districts. Read-only — fixed BSA reference data."
      />
      <div className="px-6 py-6">
        <DistrictsTable rows={rows} />
      </div>
    </div>
  );
}
