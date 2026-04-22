"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

// Listens for Supabase auth state changes and refreshes Server Components so
// the new role/club is picked up without a full reload. Runs once per tab.
export function AuthListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        router.refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  return null;
}
