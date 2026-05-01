import { AdminPageHero } from "@/components/layout/AdminPageHero";
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
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-6 py-8 pb-24">
      <AdminPageHero
        eyebrow="Platform · Clubs"
        title="New club"
        description="Five steps: club details, admin invite, greens & rinks, initial players, review & publish. Save a draft at any point."
        containerWidth="none"
      />
      <NewClubWizard districts={districts} />
    </div>
  );
}
