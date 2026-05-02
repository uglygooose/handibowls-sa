import { AlertCircle } from "lucide-react";

import { getCurrentProfile } from "@/lib/auth/profile";

import { RestoreAccountButton } from "./RestoreAccountButton";

// Phase 13 / 13-2b / Batch H2 — grace-window banner.
//
// Mounts in the (player)(gated) layout above the route content.
// Reads the user's profile via getCurrentProfile (React.cache'd
// per request, so no extra DB hit when /me also reads it). Renders
// nothing for active users (deleted_at IS NULL) — the no-pending-
// deletion path is the common case and pays only the cache lookup.
//
// When deleted_at IS NOT NULL AND pending_auth_ban = false:
//   Shows a danger-tinted banner with the days-remaining count + a
//   Restore CTA. The CTA calls restoreAccount (Batch G1 server
//   action); on success the banner disappears on the next render
//   because deleted_at is reset to NULL. router.refresh() in the
//   client component triggers the re-render.
//
// When pending_auth_ban = true (post-anonymisation, pre-Vercel-
// Cron-ban): theoretically the user can still be signed in
// briefly. Banner suppressed because restore is no longer possible
// (PII is gone; the maybeRestoreOnLogin helper short-circuits on
// pending_auth_ban=true). User signs in, sees an empty profile;
// the implicit-restore hook didn't run because of the pending_auth_ban
// check. Practical race window is < 1 hour (Vercel Cron interval).

const GRACE_WINDOW_DAYS = 30;

export async function GraceWindowBanner() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (!profile.deleted_at) return null;
  if (profile.pending_auth_ban) return null;

  const deletedAt = new Date(profile.deleted_at);
  const expiresAt = new Date(
    deletedAt.getTime() + GRACE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const msRemaining = expiresAt.getTime() - new Date().getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

  return (
    <div
      className="flex flex-col items-start gap-2 border-b border-danger-500/30 bg-danger-500/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-slot="grace-window-banner"
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertCircle
          className="mt-0.5 size-4 shrink-0 text-danger-500"
          aria-hidden="true"
        />
        <p className="text-[13px] text-ink">
          Your account is scheduled for deletion in{" "}
          <strong className="font-bold">
            {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
          </strong>
          . Sign in any time before then to restore it, or use the
          button to restore now.
        </p>
      </div>
      <RestoreAccountButton />
    </div>
  );
}
