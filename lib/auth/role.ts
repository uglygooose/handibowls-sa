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

// Extract role + club_ids from JWT app_metadata. The JWT hook (migration 009)
// populates these claims on every token issue.
function readClaims(appMetadata: Record<string, unknown> | undefined): {
  role: UserRole | null;
  clubIds: string[];
} {
  const rawRole = appMetadata?.role;
  const role =
    rawRole === "super_admin" || rawRole === "club_admin" || rawRole === "player"
      ? rawRole
      : null;
  const rawClubIds = appMetadata?.club_ids;
  const clubIds = Array.isArray(rawClubIds)
    ? rawClubIds.filter((x): x is string => typeof x === "string")
    : [];
  return { role, clubIds };
}

// Resolve the current auth context from the refreshed session cookie. Returns
// `null` when unauthenticated. Never throws — callers decide what to do.
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { role, clubIds } = readClaims(
    data.user.app_metadata as Record<string, unknown> | undefined,
  );
  // Fall back to player if the JWT hook hasn't fired yet (e.g. seed users
  // before first login). Middleware will still enforce gating.
  return {
    userId: data.user.id,
    role: role ?? "player",
    clubIds,
    email: data.user.email ?? null,
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
