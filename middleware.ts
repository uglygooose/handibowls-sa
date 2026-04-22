import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database.types";

type UserRole = "super_admin" | "club_admin" | "player";

// Route gating table. Keep in sync with lib/auth/role.ts homeFor().
const PLATFORM_PREFIX = "/platform";
const MANAGE_PREFIX = "/manage";
const PLAYER_PREFIXES = ["/play", "/book", "/tournaments", "/me"] as const;

// Paths anyone can hit — auth screens, landing, invite flow, Next internals.
function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/signup")) return true;
  if (pathname.startsWith("/invite/")) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/design" || pathname.startsWith("/design/")) return true;
  return false;
}

function homeFor(role: UserRole): string {
  if (role === "super_admin") return "/platform/clubs";
  if (role === "club_admin") return "/manage/overview";
  return "/play";
}

function allowedPrefixFor(pathname: string): "platform" | "manage" | "player" | null {
  if (pathname.startsWith(PLATFORM_PREFIX)) return "platform";
  if (pathname.startsWith(MANAGE_PREFIX)) return "manage";
  if (PLAYER_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return "player";
  }
  return null;
}

function roleCanAccess(role: UserRole, kind: "platform" | "manage" | "player"): boolean {
  if (kind === "platform") return role === "super_admin";
  if (kind === "manage") return role === "super_admin" || role === "club_admin";
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create a mutable response so we can write refreshed auth cookies onto it
  // before returning. Mirrors lib/supabase/middleware.ts.
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresh the session cookie. Also the only way to read current user.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isPublicPath(pathname)) {
    // If an authenticated user hits /login or /signup, bounce them home.
    if (
      user &&
      (pathname.startsWith("/login") || pathname.startsWith("/signup"))
    ) {
      const rawRole = (user.app_metadata as Record<string, unknown> | undefined)?.role;
      const role: UserRole =
        rawRole === "super_admin" || rawRole === "club_admin" || rawRole === "player"
          ? rawRole
          : "player";
      const url = request.nextUrl.clone();
      url.pathname = homeFor(role);
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // All non-public paths require auth.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  const rawRole = (user.app_metadata as Record<string, unknown> | undefined)?.role;
  const role: UserRole =
    rawRole === "super_admin" || rawRole === "club_admin" || rawRole === "player"
      ? rawRole
      : "player";

  const kind = allowedPrefixFor(pathname);
  if (kind === null) {
    // Authenticated but hitting an un-categorised path (e.g. /foo). Bounce
    // home. The root / is public so this only affects unknown segments.
    const url = request.nextUrl.clone();
    url.pathname = homeFor(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!roleCanAccess(role, kind)) {
    const url = request.nextUrl.clone();
    url.pathname = homeFor(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip static assets, Next internals, and the PWA service worker.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|workbox-.*|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
