import { Construction } from "lucide-react";

import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { EmptyState } from "@/components/layout/EmptyState";

// Phase 12.5 / 12.5-6 — replaces the StubPage with an
// AdminPageHero + EmptyState body so the platform Tournaments
// surface looks like the rest of the super-admin sidebar instead
// of a chrome-less placeholder. The route is reachable from the
// AdminSidebar nav; until a real implementation lands, the empty
// body is the v1-honest treatment.

export const metadata = {
  title: "Platform Tournaments · HandiBowls",
};

export default function PlatformTournaments() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
      <AdminPageHero
        eyebrow="Platform"
        title="Tournaments"
        description="Cross-club tournament directory. Coming soon — for now, manage tournaments from the host-club's /manage/tournaments surface."
        containerWidth="none"
      />
      <EmptyState
        icon={Construction}
        eyebrow="Coming soon"
        title="Cross-club tournament directory"
        body="The platform-wide tournament index lands once the data layer + visibility rules are specced. The route exists today as a redirect target so deep-links don't 404."
      />
    </div>
  );
}
