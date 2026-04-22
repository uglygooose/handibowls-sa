import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];

export const USER_ROLES: readonly UserRole[] = [
  "super_admin",
  "club_admin",
  "player",
] as const;

// Home path per role. Used for wrong-prefix redirects and post-login landing.
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

export type AuthContext = {
  userId: string;
  role: UserRole;
  clubIds: string[];
  email: string | null;
};

// Extract role + club_ids from a decoded JWT payload. The JWT hook
// (migration 009) injects these into app_metadata at token-issuance time.
// Note: we read from the JWT because Supabase's REST /user endpoint only
// returns raw_app_meta_data, which never contains hook-derived claims.
function readClaimsFromJwt(accessToken: string | null | undefined): {
  role: UserRole | null;
  clubIds: string[];
} {
  if (!accessToken) return { role: null, clubIds: [] };
  const parts = accessToken.split(".");
  if (parts.length !== 3) return { role: null, clubIds: [] };

  let payload: { app_metadata?: { role?: unknown; club_ids?: unknown } } | null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return { role: null, clubIds: [] };
  }

  const rawRole = payload?.app_metadata?.role;
  const role =
    rawRole === "super_admin" || rawRole === "club_admin" || rawRole === "player"
      ? rawRole
      : null;
  const rawClubIds = payload?.app_metadata?.club_ids;
  const clubIds = Array.isArray(rawClubIds)
    ? rawClubIds.filter((x): x is string => typeof x === "string")
    : [];
  return { role, clubIds };
}

// Resolve the current auth context from the refreshed session cookie. Returns
// `null` when unauthenticated. Never throws — callers decide what to do.
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  // getUser() validates the JWT signature server-side. getSession() afterwards
  // is a cheap local read of the already-validated token.
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { role, clubIds } = readClaimsFromJwt(session?.access_token);

  // Fall back to player if the JWT hook hasn't fired yet (e.g. seed users
  // before first login). Middleware will still enforce gating.
  return {
    userId: userData.user.id,
    role: role ?? "player",
    clubIds,
    email: userData.user.email ?? null,
  };
}

// Defence-in-depth guard for group layouts. Middleware already redirects wrong
// roles, but layouts re-check so a dropped middleware rule can't leak.
export async function requireRole(
  allowed: readonly UserRole[],
): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!allowed.includes(ctx.role)) redirect(homeFor(ctx.role));
  return ctx;
}
