import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { homeFor, type UserRole } from "@/lib/auth/role";

// Auth callback — handles two flows that Supabase can land here:
//
//   1. PKCE / OAuth / magic-link        → query param `?code=...`
//      Resolved via `exchangeCodeForSession`. Used by the magic-link
//      form on /login and (potentially) future OAuth providers.
//
//   2. Email-OTP confirmation flows     → query params `?token_hash=...&type=...`
//      Resolved via `verifyOtp`. Used by the signup-confirm + password-
//      reset + email-change + reauthenticate templates per Supabase's
//      PKCE-flow-for-SSR pattern (see Supabase docs:
//      auth/server-side/email-based-auth-with-pkce-flow-for-ssr).
//      Phase 13 / 13-8 / Batch B / Fix 2 added this branch — without
//      it, post-confirmation users landed on /login because the
//      original `?code=`-only handler saw a missing code param and
//      bailed.
//
// Both paths funnel into the same post-verification redirect logic:
// resolve the user's role from app_metadata, run the maybeRestoreOnLogin
// hook (silently un-deletes accounts within the 30-day grace window
// per Phase 13 / 13-2b / Batch G1), and 302 to either the `?next=`
// param (when relative) or the role's home surface.

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "";

  const supabase = await createClient();

  // Branch 2 — email-OTP confirmation. Higher-traffic path (every
  // signup-confirm ends here); ordering is narrative, not semantic.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      return NextResponse.redirect(new URL("/login", url));
    }
    return finishAuthRedirect(supabase, url, next);
  }

  // Branch 1 — PKCE code exchange (magic-link / OAuth).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login", url));
    }
    return finishAuthRedirect(supabase, url, next);
  }

  // Neither branch — bail to /login.
  return NextResponse.redirect(new URL("/login", url));
}

// Common post-verification path. verifyOtp / exchangeCodeForSession
// have already populated the auth cookies via the supabase-ssr
// adapter; we read the freshly-established session, run the
// restore-on-login hook, compute the role-correct redirect target,
// and 302. Bails to /login if no session is reachable (defence-in-
// depth — should not happen on the happy path).
async function finishAuthRedirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  url: URL,
  next: string,
): Promise<NextResponse> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", url));
  }

  // Phase 13 / 13-2b / Batch G1 — implicit restore-on-login.
  // Failures don't block the redirect.
  const { maybeRestoreOnLogin } = await import("@/lib/auth/restore");
  await maybeRestoreOnLogin(user.id, supabase);

  const rawRole = (user.app_metadata as Record<string, unknown> | undefined)
    ?.role;
  const role: UserRole =
    rawRole === "super_admin" ||
    rawRole === "club_admin" ||
    rawRole === "player"
      ? rawRole
      : "player";

  // Open-redirect prevention: honour `next` only when it's a same-
  // origin relative path.
  const redirectTo = next.startsWith("/") ? next : homeFor(role);
  return NextResponse.redirect(new URL(redirectTo, url));
}
