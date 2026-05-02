import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { homeFor, type UserRole } from "@/lib/auth/role";

// OAuth / magic-link callback. Supabase redirects here with a `code` query
// param; exchanging it populates the auth cookie. On success, route the user
// to their role home (or the `next` param if safe).
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "";

  if (!code) {
    return NextResponse.redirect(new URL("/login", url));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login", url));
  }

  // Phase 13 / 13-2b / Batch G1 — implicit restore-on-login. Same
  // hook as signInAction; covers the magic-link / OAuth callback
  // path. Failures don't block redirect.
  const { maybeRestoreOnLogin } = await import("@/lib/auth/restore");
  await maybeRestoreOnLogin(data.user.id, supabase);

  const rawRole = (data.user.app_metadata as Record<string, unknown> | undefined)?.role;
  const role: UserRole =
    rawRole === "super_admin" || rawRole === "club_admin" || rawRole === "player"
      ? rawRole
      : "player";

  // Only honour relative paths from `next` to avoid open-redirect.
  const redirectTo = next.startsWith("/") ? next : homeFor(role);
  return NextResponse.redirect(new URL(redirectTo, url));
}
