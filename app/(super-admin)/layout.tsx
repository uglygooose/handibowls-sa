import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/role";
import { AdminSidebar } from "@/components/nav/AdminSidebar";
import { TopBar } from "@/components/nav/TopBar";

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["super_admin"]);

  return (
    <div className="flex min-h-dvh bg-surface">
      <aside className="hidden lg:block">
        <AdminSidebar variant="platform" />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar variant="light" title="Platform" />
        <div className="bg-surface-muted px-4 py-2 text-xs text-ink-muted lg:hidden">
          Platform admin is optimised for desktop.
        </div>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
