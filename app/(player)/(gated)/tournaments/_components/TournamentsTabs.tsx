"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

// Phase 8b — URL-state Available / Entered tab switch for /tournaments.
// Mirrors the inbox tabs pattern (8a) and the Phase 7a TournamentsList
// pattern: `router.replace` keeps history clean and the active tab
// shareable via URL.

export type AvailableEnteredTab = "available" | "entered";

type Props = {
  active: AvailableEnteredTab;
  availableCount: number;
  enteredCount: number;
};

export function TournamentsTabs({
  active,
  availableCount,
  enteredCount,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (tab: AvailableEnteredTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "entered") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div
      role="tablist"
      aria-label="Tournament list filter"
      className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1"
    >
      <Tab
        active={active === "available"}
        label="Available"
        count={availableCount}
        onSelect={() => select("available")}
      />
      <Tab
        active={active === "entered"}
        label="Entered"
        count={enteredCount}
        onSelect={() => select("entered")}
      />
    </div>
  );
}

function Tab({
  active,
  label,
  count,
  onSelect,
}: {
  active: boolean;
  label: string;
  count: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-state={active ? "active" : "inactive"}
      onClick={onSelect}
      className={cn(
        "relative inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition-colors",
        active
          ? "bg-ink text-ink-inverse"
          : "text-ink-muted hover:bg-surface-muted hover:text-ink",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums",
          active
            ? "bg-white/20 text-ink-inverse"
            : "bg-surface-muted text-ink-muted",
        )}
      >
        {count}
      </span>
    </button>
  );
}
