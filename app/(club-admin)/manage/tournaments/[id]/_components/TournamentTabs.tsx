"use client";

import {
  GitFork,
  Grid3x3,
  History,
  Megaphone,
  Thermometer,
  Users,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

import { cn } from "@/lib/utils";

// URL-driven sticky tab strip for /manage/tournaments/[id]. Mirrors the
// 7a TournamentsList URL-state pattern: filter changes go through
// router.replace so they survive reload + are shareable, without
// polluting browser history.

export type TabId =
  | "entries"
  | "draw"
  | "scoring"
  | "rinks"
  | "comms"
  | "audit";

type TabSpec = {
  id: TabId;
  label: string;
  icon: LucideIcon;
};

const TABS: TabSpec[] = [
  { id: "entries", label: "Entries", icon: Users },
  { id: "draw", label: "Draw", icon: GitFork },
  { id: "scoring", label: "Scoring", icon: Grid3x3 },
  { id: "rinks", label: "Rinks", icon: Thermometer },
  { id: "comms", label: "Comms", icon: Megaphone },
  { id: "audit", label: "Audit", icon: History },
];

const TAB_IDS: ReadonlySet<TabId> = new Set(TABS.map((t) => t.id));

type Badges = Partial<Record<TabId, number | null>>;

type Props = {
  active: TabId;
  badges?: Badges;
};

export function TournamentTabs({ active, badges = {} }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const onSelect = useCallback(
    (id: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      // Default tab is omitted from the URL for clean defaults.
      if (id === "entries") {
        params.delete("tab");
      } else {
        params.set("tab", id);
      }
      const qs = params.toString();
      const target = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        router.replace(target, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return (
    <div
      data-slot="tournament-tabs"
      className="sticky top-0 z-20 -mx-8 mt-6 border-b border-border bg-surface/95 px-8 backdrop-blur supports-[backdrop-filter]:bg-surface/80"
    >
      <nav
        role="tablist"
        aria-label="Tournament admin sections"
        className="flex items-center gap-1 overflow-x-auto"
      >
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          const badge = badges[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-active={isActive}
              data-testid={`tab-${tab.id}`}
              onClick={() => onSelect(tab.id)}
              className={cn(
                "inline-flex h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-[13px] font-medium transition-colors",
                isActive
                  ? "border-primary-500 text-ink"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
              {badge != null && badge > 0 && (
                <span
                  className={cn(
                    "ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold tabular-nums",
                    isActive
                      ? "bg-primary-500 text-[color:var(--color-on-primary)]"
                      : "bg-surface-muted text-ink-muted",
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function parseTabFromUrl(value: string | undefined | null): TabId {
  if (!value) return "entries";
  const v = String(value).trim();
  return TAB_IDS.has(v as TabId) ? (v as TabId) : "entries";
}

export const ALL_TAB_IDS: TabId[] = TABS.map((t) => t.id);

// Re-export so the page-level renderer can introspect badges against
// the canonical id list.
export const useTabIds = (): TabId[] => useMemo(() => ALL_TAB_IDS, []);
