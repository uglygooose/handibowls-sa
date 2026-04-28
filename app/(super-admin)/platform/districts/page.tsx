import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/auth/role";

import { DistrictsTable } from "./_components/DistrictsTable";
import { listDistrictsWithClubCount } from "./_data";

export default async function PlatformDistricts() {
  await requireRole(["super_admin"]);

  const rows = await listDistrictsWithClubCount();

  const eyebrow = `Platform · ${rows.length} ${rows.length === 1 ? "district" : "districts"}`;

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow={eyebrow}
        title="Districts"
        description={`The ${rows.length} official Bowls South Africa districts.`}
      />
      <div className="mx-auto w-full max-w-[1440px] px-10 py-8">
        <DistrictsTable rows={rows} />
      </div>
    </div>
  );
}
