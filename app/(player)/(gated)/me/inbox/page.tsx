import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import {
  getMessagesForCurrentPlayer,
  getNotificationsForCurrentPlayer,
} from "./_data";
import { InboxTabs, type InboxTab } from "./_components/InboxTabs";
import { MessagesList, NotificationsList } from "./_components/InboxLists";

// Phase 8a — /me/inbox combined notifications + messages surface.
// URL state owns the active tab (`?tab=messages`). Mirrors the design
// source's PageInbox (player-pages.jsx:307).
//
// Phase 11 / 11-5c: tap-to-mark-read landed. The lists moved into
// _components/InboxLists.tsx (Client island) so the row taps can
// fire markNotificationRead / markMessageRecipientRead with
// optimistic UI. The Server Component still does the data
// fetching; only the rendering moved.

export const metadata = {
  title: "Inbox · HandiBowls",
};

type Props = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function InboxPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const active: InboxTab = tabParam === "messages" ? "messages" : "notifications";

  const [notifications, messages] = await Promise.all([
    getNotificationsForCurrentPlayer(),
    getMessagesForCurrentPlayer(),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 pb-24 pt-5">
      {/* Header — back link + h1. Matches the design's MTopBar with
          back button shape. */}
      <div className="flex items-center gap-2">
        <Link
          href="/me"
          className="inline-flex h-9 items-center gap-1 rounded-md px-1.5 text-[13px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back
        </Link>
      </div>
      <h1 className="font-display text-3xl font-black italic leading-none tracking-tight">
        Inbox
      </h1>

      <InboxTabs
        active={active}
        notificationCount={notifications.length}
        messageCount={messages.length}
      />

      {active === "notifications" ? (
        <NotificationsList rows={notifications} />
      ) : (
        <MessagesList rows={messages} />
      )}
    </div>
  );
}
