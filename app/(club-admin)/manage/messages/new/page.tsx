import Link from "next/link";

import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { requireRole } from "@/lib/auth/role";

import { ComposeForm } from "../_components/ComposeForm";
import { listMembersForClub, listTournamentsForClub } from "../_data";

// Phase 11 / 11-3b — `/manage/messages/new` admin compose surface.
//
// Server Component composes the hero + the form-island handoff.
// The form lives in a Client island (<ComposeForm />) because it
// owns useActionState + controlled inputs.
//
// Hero matches the design language established by /manage/t20/new
// — speckle hero + single splatter accent rotated +18° at 260px,
// mono-cap kicker, Barlow Condensed display heading.
//
// super_admin without a host club lands on the standard empty
// card pointing at /platform/clubs.

export const metadata = {
  title: "New message · HandiBowls",
};

export default async function ManageMessagesNewPage() {
  await requireRole(["club_admin", "super_admin"]);

  const [hostClub, tournamentsResult, membersResult] = await Promise.all([
    getCurrentHostClub(),
    listTournamentsForClub(),
    listMembersForClub(),
  ]);
  if (!hostClub) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-6 py-8 pb-24">
        <AdminPageHero
          eyebrow="Club admin"
          title="New message"
          containerWidth="none"
        />
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-ink-muted">
            No club is in scope for this account. Use{" "}
            <Link
              href="/platform/clubs"
              className="font-medium text-ink underline"
            >
              Platform · Clubs
            </Link>{" "}
            to pick a club to manage.
          </p>
        </div>
      </div>
    );
  }

  const splatterPreset = hostClub.club_theme_preset ?? "atomic-red";
  const tournaments = tournamentsResult.ok ? tournamentsResult.rows : [];
  const members = membersResult.ok ? membersResult.rows : [];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-6 py-8 pb-24">
      <AdminPageHero
        eyebrow="Club admin · New message"
        title="Compose"
        description="Write the broadcast members see in their HandiBowls inbox. Save a draft, schedule it, or send it right now."
        speckle={{ seed: "messages-new-hero", density: "med", opacity: 0.06 }}
        splatter={{ preset: splatterPreset, variant: 0, size: "L", rotate: 18, opacity: 0.55 }}
        containerWidth="none"
      />

      <ComposeForm tournaments={tournaments} members={members} />
    </div>
  );
}
