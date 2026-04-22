import "server-only";

import { createClient } from "@/lib/supabase/server";
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
  if (!user) return DEFAULT_THEME;

  const role = (user.app_metadata as Record<string, unknown> | undefined)?.role;
  if (role === "super_admin") return DEFAULT_THEME;

  if (role === "club_admin") {
    const { data } = await supabase
      .from("club_admin_assignments")
      .select("clubs(theme_preset)")
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle();
    const preset = data?.clubs?.theme_preset;
    return (preset as ThemePreset | undefined) ?? DEFAULT_THEME;
  }

  // Default: player. Look up primary active membership.
  const { data } = await supabase
    .from("club_memberships")
    .select("is_primary, clubs(theme_preset)")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  const preset = data?.clubs?.theme_preset;
  return (preset as ThemePreset | undefined) ?? DEFAULT_THEME;
}
