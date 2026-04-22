import "server-only";

import type { UserRole } from "@/lib/auth/role";

// Extracts the role claim from a Supabase access-token JWT.
//
// Why: the custom_access_token_hook (see migrations) injects role + club_ids
// into the JWT's app_metadata claim at token-issuance time, but Supabase's
// REST endpoints return raw_app_meta_data from auth.users — which does NOT
// include these hook-derived claims. Reading user.app_metadata.role after
// signInWithPassword / getUser therefore yields undefined. The JWT payload
// is the only place the role actually lives for authenticated requests.
export function roleFromAccessToken(accessToken: string | null | undefined): UserRole | null {
  if (!accessToken) return null;
  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;

  let payload: unknown;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }

  const appMeta = (payload as { app_metadata?: { role?: unknown } } | null)?.app_metadata;
  const raw = appMeta?.role;
  if (raw === "super_admin" || raw === "club_admin" || raw === "player") return raw;
  return null;
}
