"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// Phase 8a — URL-state tab switcher for /me/inbox. Mirrors the Phase
// 7a TournamentsList pattern: `router.replace` with shallow params so
// the active tab survives reload + share without polluting history.

export type InboxTab = "notifications" | "messages";

type Props = {
  active: InboxTab;
  notificationCount: number;
  messageCount: number;
};

export function InboxTabs({ active, notificationCount, messageCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (tab: InboxTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "notifications") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div
      role="tablist"
      aria-label="Inbox sections"
      className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1"
    >
      <Tab
        active={active === "notifications"}
        label="Notifications"
        count={notificationCount}
        onSelect={() => select("notifications")}
      />
      <Tab
        active={active === "messages"}
        label="Messages"
        count={messageCount}
        onSelect={() => select("messages")}
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
          active ? "bg-white/20 text-ink-inverse" : "bg-surface-muted text-ink-muted",
        )}
      >
        {count}
      </span>
    </button>
  );
}
