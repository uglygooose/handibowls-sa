import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/nav/AdminSidebar";
import { TopBar } from "@/components/nav/TopBar";
import { requireRole } from "@/lib/auth/role";

function deriveIdentity(email: string | null) {
  if (!email) return { userInitial: "?", userName: "Signed in" };
  const handle = email.split("@")[0];
  // "Andrew Thomas Els" → "AE" (first + last initial). For seed accounts like
  // super@handibowls.local the handle has no spaces — fall back to first two
  // characters of the local part.
  const parts = handle.replace(/[._-]+/g, " ").trim().split(/\s+/);
  const initial =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : handle.slice(0, 2).toUpperCase();
  const display = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
  return { userInitial: initial, userName: display || handle };
}

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await requireRole(["super_admin"]);
  const { userInitial, userName } = deriveIdentity(ctx.email);

  return (
    <div className="flex min-h-dvh bg-surface">
      <aside className="hidden lg:block">
        <AdminSidebar
          variant="platform"
          userInitial={userInitial}
          userName={userName}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar variant="platform" userInitial={userInitial} />
        <div className="bg-surface-muted px-4 py-2 text-xs text-ink-muted lg:hidden">
          Platform admin is optimised for desktop.
        </div>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
