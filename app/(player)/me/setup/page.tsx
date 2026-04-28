import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/profile";
import { getAuthContext } from "@/lib/auth/role";

import { SetupWizard } from "./_components/SetupWizard";
import type { ProfilePrefill } from "./_schema";

export const metadata = {
  title: "Complete your profile · HandiBowls",
};

export default async function MeSetupPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  // Single source of truth for "the current user's profile" — same React.cache-
  // wrapped fetcher used by the (player) layout chain. The wizard step types
  // pick out the columns they need from ProfileRow.
  const profile = await getCurrentProfile();

  // Returning visitors who've already completed setup don't need the wizard;
  // bounce them to /play so they don't accidentally re-prompt their consents.
  if (profile?.profile_completed) redirect("/play");

  const prefill: ProfilePrefill = {
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
    display_name: profile?.display_name ?? null,
    gender: profile?.gender ?? null,
    date_of_birth: profile?.date_of_birth ?? null,
    bsa_number: profile?.bsa_number ?? null,
    dominant_hand: profile?.dominant_hand ?? null,
    phone: profile?.phone ?? null,
    email_opt_in: profile?.email_opt_in ?? true,
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <header className="mb-6">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          One-time setup
        </span>
        <h1 className="mt-1 font-display text-3xl font-extrabold italic tracking-tight">
          Complete your profile
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Four short steps. Your club admin pre-filled what they could; tweak
          and confirm before stepping onto the green.
        </p>
      </header>

      <SetupWizard prefill={prefill} email={ctx.email ?? ""} />
    </div>
  );
}
