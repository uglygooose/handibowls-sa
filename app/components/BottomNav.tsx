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
        .from("profiles")
        .select("role, is_admin")
        .eq("id", user.id)
        .maybeSingle();

      const role = String((res.data as any)?.role ?? "").toUpperCase();
      const adminFlag = Boolean((res.data as any)?.is_admin);
      setIsAdmin(role === "SUPER_ADMIN" || adminFlag);
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
    "w-full rounded-full border px-1.5 py-2 text-center text-[11px] font-semibold leading-tight transition whitespace-normal sm:px-2 sm:text-xs";

  function pill(active: boolean) {
    return `${pillBase} ${
      active ? "border-green-700 bg-green-700 text-white" : "border-green-700 bg-white text-green-700"
    }`;
  }

  const cols = isAdmin ? "grid-cols-5" : "grid-cols-4";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur">
      <div className="mx-auto w-full max-w-[560px] px-[14px] pt-2 pb-[env(safe-area-inset-bottom)]">
        <div className={`grid ${cols} gap-1.5 sm:gap-2`}>
          <Link href="/" className={pill(isActive("/"))}>
            Home
          </Link>

          <Link href="/club-ladder" className={pill(isActive("/club-ladder"))}>
            <span className="hidden sm:inline">Leaderboard</span>
            <span className="sm:hidden">Board</span>
          </Link>

          <Link href="/my-challenges" className={pill(isActive("/my-challenges"))}>
            <span className="hidden sm:inline">Challenges</span>
            <span className="sm:hidden">Chal.</span>
          </Link>

          <Link href="/tournaments" className={pill(isActive("/tournaments"))}>
            <span className="hidden sm:inline">Tournaments</span>
            <span className="sm:hidden">Tourn.</span>
          </Link>

          {isAdmin ? (
            <Link href="/admin/tournaments" className={pill(isActive("/admin"))} title="Admin tournaments">
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
