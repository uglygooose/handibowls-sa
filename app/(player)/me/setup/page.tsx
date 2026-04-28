import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

import { SetupWizard } from "./_components/SetupWizard";
import type { ProfilePrefill } from "./_schema";

export const metadata = {
  title: "Complete your profile · HandiBowls",
};

export default async function MeSetupPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "first_name, last_name, display_name, gender, date_of_birth, bsa_number, dominant_hand, phone, email_opt_in, profile_completed",
    )
    .eq("id", ctx.userId)
    .maybeSingle();

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
