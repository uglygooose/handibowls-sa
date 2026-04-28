import "server-only";

import { cache } from "react";

import { getAuthContext } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

// React.cache memoises within a single request — both the (player) gate
// layout and any (player) page that wants profile fields share one DB
// query per render. Returns null when the caller is unauthenticated;
// callers decide whether to redirect.
export const getCurrentProfile = cache(async (): Promise<ProfileRow | null> => {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", ctx.userId)
    .maybeSingle();
  return data;
});
