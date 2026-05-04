import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database.types";
import { decideRedirect, type UserRole } from "@/lib/auth/routing";
import { roleFromAccessToken } from "@/lib/auth/jwt";
import {
  buildContentSecurityPolicy,
  buildReportingEndpoints,
  generateNonce,
  readCspEnv,
  resolveSentryEndpoint,
} from "@/lib/security/csp";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Phase 13 / 13-7 Batch A reattack — per-request CSP nonce.
  //
  // Generate before any NextResponse construction so we can stamp it
  // onto the request headers (so Next's framework picks it up for its
  // own inline scripts + Server Components can read via `headers()`)
  // AND onto the response headers (the actual CSP policy the browser
  // enforces).
  const nonce = generateNonce();
  const sentry = resolveSentryEndpoint();
  const cspValue = buildContentSecurityPolicy({
    nonce,
    sentry,
    ...readCspEnv(),
  });
  const reportingEndpoints = buildReportingEndpoints(sentry);

  // Create a mutable request-headers object that downstream code reads.
  // Setting `x-nonce` here is what triggers Next.js's framework script
  // injector to nonce its own inline scripts (hydration boundaries,
  // route prefetch). The header set on `request` flows into
  // `NextResponse.next({ request: { headers } })`.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // Stamp CSP + Reporting-Endpoints headers onto every response shape
  // (initial pass-through, supabase cookie-rotation rebuild, and the
  // role-redirect path). Pulled into a local helper so the three call
  // sites stay in lockstep — losing CSP on any of them re-introduces
  // the violations the 13-7 Batch A flip surfaced.
  const applySecurityHeaders = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", cspValue);
    res.headers.set("Reporting-Endpoints", reportingEndpoints);
    return res;
  };

  // Create a mutable response so we can write refreshed auth cookies onto it
  // before returning. Mirrors lib/supabase/middleware.ts.
  let response = applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
  );

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
          response = applySecurityHeaders(
            NextResponse.next({ request: { headers: requestHeaders } }),
          );
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
  return applySecurityHeaders(NextResponse.redirect(url));
}

export const config = {
  // Skip static assets, Next internals, and the PWA service worker.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|workbox-.*|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
