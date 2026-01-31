"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function BottomNav() {
  const pathname = usePathname();
  const supabase = createClient();

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        return;
      }

      const res = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      setIsAdmin(!!res.data?.user_id);
    }

    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function isActive(path: string) {
    if (!pathname) return false;
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  }

  const pillBase =
    "w-full rounded-full border px-2 py-2 text-center text-xs font-semibold transition whitespace-nowrap";

  function pill(active: boolean) {
    return `${pillBase} ${
      active ? "border-green-700 bg-green-700 text-white" : "border-green-700 bg-white text-green-700"
    }`;
  }

  const cols = isAdmin ? "grid-cols-5" : "grid-cols-4";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur">
      <div className="mx-auto w-full max-w-[560px] px-[14px] pt-2 pb-[env(safe-area-inset-bottom)]">
        <div className={`grid ${cols} gap-2`}>
          <Link href="/" className={pill(isActive("/"))}>
            Home
          </Link>

          <Link href="/club-ladder" className={pill(isActive("/club-ladder"))}>
            Leaderboard
          </Link>

          <Link href="/my-challenges" className={pill(isActive("/my-challenges"))}>
            Challenges
          </Link>

          <Link href="/tournaments" className={pill(isActive("/tournaments"))}>
            Tournaments
          </Link>

          {isAdmin ? (
            <Link
              href="/admin/tournaments"
              className={pill(isActive("/admin"))}
              title="Admin tournaments"
            >
              Admin
            </Link>
          ) : null}
        </div>

        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full border border-red-600 px-8 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-600 hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}