// lib/auth/adminGate.ts
// Canonical admin access check. Pure wrapper over Supabase client calls;
// no side effects (no navigation, no state setting) — callers handle UI.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminGateFailure =
  | { ok: false; reason: "NOT_AUTHENTICATED"; message: null }
  | { ok: false; reason: "PROFILE_ERROR"; message: string | null }
  | { ok: false; reason: "NOT_ADMIN"; message: null };

export type AdminGateSuccess = {
  ok: true;
  isSuperAdmin: boolean;
  adminClubId: string | null;
};

export type AdminGateResult = AdminGateSuccess | AdminGateFailure;

export async function adminGate(supabase: SupabaseClient): Promise<AdminGateResult> {
  const userRes = await supabase.auth.getUser();
  const user = userRes.data.user;
  if (!user) return { ok: false, reason: "NOT_AUTHENTICATED", message: null };

  const profRes = await supabase
    .from("profiles")
    .select("role, is_admin, club_id")
    .eq("id", user.id)
    .single();

  if (profRes.error) {
    return { ok: false, reason: "PROFILE_ERROR", message: profRes.error.message };
  }
  if (!profRes.data) {
    return { ok: false, reason: "PROFILE_ERROR", message: "Profile not found." };
  }

  const data = profRes.data as { role: string | null; is_admin: boolean | null; club_id: string | null };
  const role = String(data.role ?? "").toUpperCase();
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdminFlag = Boolean(data.is_admin);

  if (!isSuperAdmin && !isAdminFlag) {
    return { ok: false, reason: "NOT_ADMIN", message: null };
  }

  const adminClubId = isSuperAdmin ? null : data.club_id ? String(data.club_id) : null;
  return { ok: true, isSuperAdmin, adminClubId };
}
