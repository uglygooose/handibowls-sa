import "server-only";

import { createClient } from "@/lib/supabase/server";
import { roleFromAccessToken } from "@/lib/auth/jwt";
import type { ThemePreset } from "@/components/brand/ThemeApplier";

export const DEFAULT_THEME: ThemePreset = "core-black";

// Resolve the theme preset to render for the current request:
//   - unauthenticated → core-black (marketing / auth screens)
//   - super_admin     → core-black (platform surfaces, no home club)
//   - club_admin      → the preset of the first active admin assignment
//   - player          → the preset of their primary active club membership
// Bad/missing data falls through to core-black so an empty club_memberships
// row never crashes first render.
export async function resolveActiveTheme(): Promise<ThemePreset> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    if (process.env.NODE_ENV === "development") console.log("[theme] unauth → core-black");
    return DEFAULT_THEME;
  }

  // Role lives in the JWT app_metadata claim (hook-injected), not in
  // user.app_metadata. See lib/auth/jwt.ts.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const role = roleFromAccessToken(session?.access_token);

  if (role === "super_admin") {
    if (process.env.NODE_ENV === "development") console.log("[theme] super_admin → core-black");
    return DEFAULT_THEME;
  }

  if (role === "club_admin") {
    const { data } = await supabase
      .from("club_admin_assignments")
      .select("clubs(theme_preset)")
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle();
    const preset = data?.clubs?.theme_preset as ThemePreset | undefined;
    if (process.env.NODE_ENV === "development") {
      console.log(`[theme] club_admin ${user.email} → ${preset ?? "core-black (no assignment)"}`);
    }
    return preset ?? DEFAULT_THEME;
  }

  // Default: player (includes null role as a safety fallback). Look up
  // primary active membership.
  const { data } = await supabase
    .from("club_memberships")
    .select("is_primary, clubs(theme_preset)")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  const preset = data?.clubs?.theme_preset as ThemePreset | undefined;
  if (process.env.NODE_ENV === "development") {
    console.log(`[theme] player ${user.email} → ${preset ?? "core-black (no membership)"}`);
  }
  return preset ?? DEFAULT_THEME;
}
