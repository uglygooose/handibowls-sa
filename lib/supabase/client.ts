"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

// Browser Supabase client. Use inside Client Components.
// NEVER import this into Server Components / Route Handlers — they have their
// own `server.ts` / `service.ts` variants.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
