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

  // Routing-hint only: read the session from the cookie and decode the role
  // claim locally. Authoritative authorization happens downstream —
  // `requireRole` in RSC layouts calls `getUser()` (serialized per page
  // render), and RLS policies gate every data read. Calling `getUser()` here
  // caused AuthRetryableFetchError storms under Next.js RSC prefetch bursts
  // (10+ concurrent /auth/v1/user hits overwhelm the local GoTrue). See
  // Phase 4c.5 notes.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const role: UserRole | null = roleFromAccessToken(session?.access_token);

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
