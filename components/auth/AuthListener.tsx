"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

// Listens for Supabase auth state changes and refreshes Server Components so
// the new role/club is picked up without a full reload. Runs once per tab.
//
// Phase 13 / 13-5 / Batch A — also bridges Supabase auth state into
// Sentry's setUser context. POPIA: id-only (the opaque profile UUID),
// no email / IP / display_name. Cleared on SIGNED_OUT so a subsequent
// browser-side error captured before the next sign-in doesn't carry
// the stale user id.
export function AuthListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        Sentry.setUser(null);
      } else if (
        session?.user?.id &&
        (event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED")
      ) {
        Sentry.setUser({ id: session.user.id });
      }

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
