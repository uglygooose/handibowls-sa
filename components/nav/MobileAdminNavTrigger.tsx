"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { AdminSidebar } from "@/components/nav/AdminSidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Phase 14: hamburger trigger that surfaces AdminSidebar inside a Sheet on
// viewports below `lg`. Mirrors the layouts' own `hidden lg:block` gate so
// the affordance is visible exactly when the sidebar is hidden, leaving the
// 768–1024 px range no longer trapped without nav.
//
// AdminSidebar is reused verbatim — no fork, no mobile-only variant.

type Variant = "club_admin" | "super_admin";

type Identity = {
  primary: string;
  role: string;
  decorPreset?: ThemePreset;
  bowlSeed?: string;
};

type Props = {
  variant: Variant;
  identity: Identity;
};

export function MobileAdminNavTrigger({ variant, identity }: Props) {
  const pathname = usePathname();
  // `openOnPath` snapshots the route at which the sheet was opened. The
  // sheet is open iff the snapshot still matches the current path — so a
  // navigation (which changes pathname) closes the sheet without needing
  // an effect. Avoids the react-hooks/set-state-in-effect lint and the
  // cascading-render cost of `useEffect(() => setOpen(false), [pathname])`.
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const open = openOnPath !== null && openOnPath === pathname;

  const handleOpenChange = (next: boolean) => {
    setOpenOnPath(next ? pathname : null);
  };

  const navLabel =
    variant === "super_admin" ? "Platform navigation" : "Admin navigation";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-md"
          className="-ml-2 lg:hidden"
          aria-label={`Open ${navLabel.toLowerCase()}`}
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-64 border-r-0 bg-surface-inverse p-0 sm:max-w-[16rem]"
      >
        <SheetTitle className="sr-only">{navLabel}</SheetTitle>
        <SheetDescription className="sr-only">
          {variant === "super_admin"
            ? "Navigate between platform admin sections."
            : "Navigate between club admin sections."}
        </SheetDescription>
        <AdminSidebar variant={variant} identity={identity} />
      </SheetContent>
    </Sheet>
  );
}
