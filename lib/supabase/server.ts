import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createAuthedServerClient() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            try {
              cookieStore.set(name, value, options as CookieOptions);
            } catch {
              // In server components we may be called in a read-only context.
              // Swallow intentionally — middleware will refresh the session.
            }
          }
        },
      },
    }
  );

  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user ?? null;

  return { supabase, user };
}
