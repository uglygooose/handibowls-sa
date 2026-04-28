import { requireRole } from "@/lib/auth/role";

import { listDistricts } from "../_data";
import { NewClubWizard } from "./_components/NewClubWizard";

export const metadata = {
  title: "New club · HandiBowls",
};

export default async function NewClubPage() {
  await requireRole(["super_admin"]);

  const districts = await listDistricts();

  // No top-level PageHeader on the wizard — the wizard owns its own
  // per-step chrome (eyebrow + step-specific title + cancel button)
  // per the design.
  return <NewClubWizard districts={districts} />;
}
