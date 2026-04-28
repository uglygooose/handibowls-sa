import { redirect } from "next/navigation";

import { getCurrentMemberships } from "@/lib/auth/memberships";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getAuthContext } from "@/lib/auth/role";

import { ClubMembershipList } from "./_components/ClubMembershipList";

export const metadata = {
  title: "Me · HandiBowls",
};

function displayName(
  first: string | null | undefined,
  last: string | null | undefined,
  display: string | null | undefined,
  email: string | null,
) {
  if (display) return display;
  const composed = [first, last].filter(Boolean).join(" ").trim();
  return composed || email || "Player";
}

export default async function MePage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  // Both reads are React.cache-shared with the (player) layout's reads —
  // zero extra DB hits.
  const [profile, memberships] = await Promise.all([
    getCurrentProfile(),
    getCurrentMemberships(),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <header className="mb-8">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          Profile
        </span>
        <h1 className="mt-1 font-display text-3xl font-extrabold italic tracking-tight">
          {displayName(profile?.first_name, profile?.last_name, profile?.display_name, ctx.email)}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">{ctx.email}</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold tracking-tight">Your clubs</h2>
        <ClubMembershipList
          memberships={memberships.map((m) => ({
            membership_id: m.membership_id,
            club_id: m.club_id,
            club_name: m.club_name,
            club_grading: m.club_grading,
            is_primary: m.is_primary,
            joined_at: m.joined_at,
          }))}
        />
      </section>
    </div>
  );
}
