import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database.types";
import { decideRedirect, type UserRole } from "@/lib/auth/routing";
import { roleFromAccessToken } from "@/lib/auth/jwt";

export async function proxy(request: NextRequest) {
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

  // getUser() refreshes + validates the session cookie; getSession() afterwards
  // is a cheap read of the validated token. Role lives in the JWT's
  // app_metadata claim (hook-injected) — not in user.app_metadata which only
  // mirrors raw_app_meta_data. See lib/auth/jwt.ts.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: UserRole | null = null;
  if (user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    role = roleFromAccessToken(session?.access_token);
  }

  const target = decideRedirect(pathname, role ? { role } : null);
  if (target === null) return response;

  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = target === "/login" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Skip static assets, Next internals, and the PWA service worker.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|workbox-.*|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
