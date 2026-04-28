// Pure route-gating helpers. Shared between middleware.ts (edge runtime) and
// tests. Keep free of Next / Supabase imports so the test harness can load it
// without mocking anything.

import type { Database } from "@/types/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];

export type PathKind = "platform" | "manage" | "player";

const PLATFORM_PREFIX = "/platform";
const MANAGE_PREFIX = "/manage";
const PLAYER_PREFIXES = ["/play", "/book", "/tournaments", "/me"] as const;

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/signup")) return true;
  if (pathname.startsWith("/invite/")) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/design" || pathname.startsWith("/design/")) return true;
  // /payments is the v2-roadmap landing page linked from the new-tournament
  // entry-fee placeholder. Public per the Phase 7d brief — anyone clicking
  // the entry-fee link from a logged-out player surface lands here, and
  // logged-in admins also need it without bouncing through /manage.
  if (pathname === "/payments" || pathname.startsWith("/payments/")) return true;
  return false;
}

export function homeFor(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "/platform/clubs";
    case "club_admin":
      return "/manage/overview";
    case "player":
      return "/play";
  }
}

export function pathKind(pathname: string): PathKind | null {
  if (pathname.startsWith(PLATFORM_PREFIX)) return "platform";
  if (pathname.startsWith(MANAGE_PREFIX)) return "manage";
  if (PLAYER_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return "player";
  }
  return null;
}

export function roleCanAccess(role: UserRole, kind: PathKind): boolean {
  if (kind === "platform") return role === "super_admin";
  if (kind === "manage") return role === "super_admin" || role === "club_admin";
  return true;
}

// Returns the target pathname the middleware should redirect to, or null to
// let the request through. Pure: no cookies, no I/O.
export function decideRedirect(
  pathname: string,
  user: { role: UserRole } | null,
): string | null {
  if (isPublicPath(pathname)) {
    if (
      user &&
      (pathname.startsWith("/login") || pathname.startsWith("/signup"))
    ) {
      return homeFor(user.role);
    }
    return null;
  }
  if (!user) return "/login";

  const kind = pathKind(pathname);
  if (kind === null) return homeFor(user.role);
  if (!roleCanAccess(user.role, kind)) return homeFor(user.role);
  return null;
}
