"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Phase 12.5 / 12.5-1 (audit id `tabs-fork`): unified mobile tab-bar
// primitive built on the shadcn `<Tabs>` (Radix Tabs) primitive.
// Replaces hand-rolled tablist patterns on player surfaces (the original
// `/me/inbox` was a 40px pill-segmented-control); shadcn `<Tabs>`
// remains the default for admin/desktop tabs.
//
// Visual contract per audit `tabs-fork`:
//   - 60px tall list
//   - 12px uppercase label
//   - primary-500 underline on the active trigger
//   - count badge optional per tab
//   - same ARIA semantics as Radix Tabs (role=tablist + tab + tabpanel)
//
// Behaviour: URL-driven via `useRouter().replace(...)`. The first item's
// value is the default — when active, the search-param key is removed.

export type MobileTabBarItem = {
  value: string;
  label: string;
  count?: number;
};

type Props = {
  items: MobileTabBarItem[];
  active: string;
  /** URL search-param key to write the active tab into. Default: `"tab"`. */
  paramKey?: string;
  ariaLabel: string;
  className?: string;
};

export function MobileTabBar({
  items,
  active,
  paramKey = "tab",
  ariaLabel,
  className,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onValueChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === items[0]?.value) params.delete(paramKey);
    else params.set(paramKey, next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <Tabs
      value={active}
      onValueChange={onValueChange}
      className={cn("flex flex-col", className)}
    >
      <TabsList
        variant="line"
        aria-label={ariaLabel}
        className={cn(
          // 60px tall, full-width, no rounded box, no padding — line skin.
          "group-data-horizontal/tabs:h-[60px] w-full justify-stretch gap-0 rounded-none border-b border-border bg-transparent px-0",
        )}
      >
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className={cn(
              // 12px uppercase label per audit; flex-1 spreads triggers
              // evenly across the bar.
              "flex-1 rounded-none px-1 text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted",
              // Active state: primary-500 colour + primary-500 underline
              // (shadcn `variant=line` ships an `::after` underline tied
              // to `data-active` — recolour it via the `[&::after]`
              // selector since the upstream uses `bg-foreground`).
              "data-active:text-accent-ink [&::after]:!bg-primary-500 [&::after]:!h-[2px] [&::after]:!bottom-[-1px]",
            )}
          >
            <span className="flex items-center gap-1.5">
              {item.label}
              {item.count != null && (
                <span
                  data-slot="count-badge"
                  className={cn(
                    "rounded-full bg-surface-muted px-1.5 py-0.5",
                    "font-mono text-[10px] font-bold tabular-nums text-ink-muted",
                    "group-data-active/tabs-trigger:bg-primary-500/12 group-data-active/tabs-trigger:text-accent-ink",
                  )}
                >
                  {item.count}
                </span>
              )}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
