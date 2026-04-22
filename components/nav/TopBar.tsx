import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { HandiBowlsWordmark } from "@/components/brand/HandiBowlsWordmark";

type Props = {
  title?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  variant?: "light" | "dark";
  className?: string;
};

export function TopBar({
  title,
  left,
  right,
  variant = "light",
  className,
}: Props) {
  const isDark = variant === "dark";
  return (
    <header
      data-slot="top-bar"
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4",
        isDark
          ? "border-sidebar-border bg-surface-inverse text-ink-inverse"
          : "border-border bg-surface text-ink",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {left}
        {title ? (
          <h1 className="truncate font-display text-lg font-bold tracking-tight">
            {title}
          </h1>
        ) : (
          <HandiBowlsWordmark variant={isDark ? "dark" : "light"} height={24} />
        )}
      </div>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </header>
  );
}
