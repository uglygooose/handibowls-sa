import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { requireRole } from "@/lib/auth/role";

import { DistrictsTable } from "./_components/DistrictsTable";
import { listDistrictsWithClubCount } from "./_data";

export default async function PlatformDistricts() {
  await requireRole(["super_admin"]);

  const rows = await listDistrictsWithClubCount();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
      <AdminPageHero
        eyebrow="Platform"
        title="Districts"
        description="Bowls South Africa districts. Read-only — fixed BSA reference data."
        containerWidth="none"
      />
      <DistrictsTable rows={rows} />
    </div>
  );
}
