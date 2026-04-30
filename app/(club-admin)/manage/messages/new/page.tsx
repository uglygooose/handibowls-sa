import Link from "next/link";

import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { requireRole } from "@/lib/auth/role";

import { ComposeForm } from "../_components/ComposeForm";

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

  const hostClub = await getCurrentHostClub();
  if (!hostClub) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-6">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            Club admin
          </span>
          <h1 className="mt-1 font-display text-3xl font-extrabold italic tracking-tight">
            New message
          </h1>
        </header>
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

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-6 py-8 pb-24">
      {/* HERO — speckle backing + single splatter accent matching design */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface px-8 py-7">
        <div className="pointer-events-none absolute inset-0 z-0">
          <SpeckleLayer
            seed="messages-new-hero"
            density="med"
            opacity={0.06}
          />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-10 z-0 opacity-[0.55]"
        >
          <SplatterAccent
            preset={splatterPreset}
            variant={0}
            size={260}
            rotate={18}
          />
        </div>
        <div className="relative z-10 flex min-h-[128px] flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Club admin · New message
            </div>
            <h1 className="mt-1.5 font-display text-[48px] font-black italic leading-[1.05] tracking-tight">
              Compose
            </h1>
            <p className="mt-2 max-w-[64ch] text-[14px] text-ink-muted">
              Write the broadcast members see in their HandiBowls inbox. Save
              a draft, schedule it, or send it right now.
            </p>
          </div>
        </div>
      </div>

      {/* FORM ISLAND */}
      <ComposeForm />
    </div>
  );
}
