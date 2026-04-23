import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/auth/role";

import { listDistricts } from "../_data";
import { NewClubWizard } from "./_components/NewClubWizard";

export const metadata = {
  title: "New club · HandiBowls",
};

export default async function NewClubPage() {
  await requireRole(["super_admin"]);

  const districts = await listDistricts();

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Platform · Clubs"
        title="New club"
        description="Five steps: club details, admin invite, greens & rinks, initial players, review & publish. Save a draft at any point."
      />
      <div className="px-6 py-6">
        <NewClubWizard districts={districts} />
      </div>
    </div>
  );
}
