import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth/role";
import { AdminSidebar, type AdminSidebarItem } from "@/components/nav/AdminSidebar";
import { TopBar } from "@/components/nav/TopBar";
import {
  LayoutDashboard,
  Users,
  MapPin,
  Trophy,
  ClipboardList,
  MessageSquare,
} from "lucide-react";

const CLUB_ADMIN_ITEMS: AdminSidebarItem[] = [
  { href: "/manage/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/manage/members", label: "Members", icon: Users },
  { href: "/manage/greens", label: "Greens", icon: MapPin },
  { href: "/manage/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/manage/t20", label: "T20", icon: ClipboardList },
  { href: "/manage/messages", label: "Messages", icon: MessageSquare },
];

export default async function ClubAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["club_admin", "super_admin"]);

  return (
    <div className="flex min-h-dvh bg-surface">
      <aside className="hidden lg:block">
        <AdminSidebar items={CLUB_ADMIN_ITEMS} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar variant="light" />
        <div className="bg-surface-muted px-4 py-2 text-xs text-ink-muted lg:hidden">
          Admin features are optimised for desktop.
        </div>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
