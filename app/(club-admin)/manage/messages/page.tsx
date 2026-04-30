import { Inbox, MessageSquare, Sparkles } from "lucide-react";
import Link from "next/link";

import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { requireRole } from "@/lib/auth/role";

import { MessagesListClient } from "./_components/MessagesListClient";
import { listMessagesForClub, type MessagesListMode } from "./_data";

// Phase 11 / 11-3a — `/manage/messages` admin broadcast list.
//
// Replaces the StubPage with the production list. Server Component
// composes the hero + a chip-pill summary; the filter chips + row
// rendering live in a focused Client island
// (<MessagesListClient />), matching the /manage/t20 split.
//
// In-app channel only in v1 — the compose UI hard-codes
// send_email = false, and this list page does not surface channel
// chrome (no "email opened/bounced" pills). The InviteEmail path
// is system-triggered and does not flow through the messages
// table (sent directly via Resend at invite-creation time per
// locked decision #3).
//
// super_admin lands without a host club → empty card pointing at
// /platform/clubs (matches /manage/t20 + /manage/greens precedent).

export const metadata = {
  title: "Messages · HandiBowls",
};

type SearchParams = Promise<{ tab?: string }>;

export default async function ManageMessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["club_admin", "super_admin"]);

  const params = await searchParams;
  const mode: MessagesListMode = params.tab === "sent" ? "sent" : "inbox";

  const [hostClub, listResult] = await Promise.all([
    getCurrentHostClub(),
    listMessagesForClub(mode),
  ]);

  if (!listResult.ok) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-6">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            Club admin
          </span>
          <h1 className="mt-1 font-display text-3xl font-extrabold italic tracking-tight">
            Messages
          </h1>
        </header>
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-ink-muted">
            No club is in scope for this account. Use{" "}
            <Link
              href="/platform/clubs"
              className="font-medium text-ink underline"
            >
              Platform · Clubs
            </Link>{" "}
            to pick a club to manage.
          </p>
        </div>
      </div>
    );
  }

  const rows = listResult.rows;
  const clubName = hostClub?.club_name ?? listResult.clubName;
  const splatterPreset = hostClub?.club_theme_preset ?? "atomic-red";

  const draftCount = rows.filter((r) => r.status === "draft").length;
  const queuedCount = rows.filter((r) => r.status === "queued").length;
  const sentCount = rows.filter((r) => r.status === "sent").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;

  const subtitle =
    rows.length === 0
      ? `In-app broadcasts to your members at ${clubName}. Compose your first message to start the conversation.`
      : `In-app broadcasts to your members at ${clubName}. ${rows.length} on the books · ${sentCount} sent · ${queuedCount} queued.`;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
      {/* HERO — speckle + double-splatter accent matching /manage/t20 */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface px-8 py-7">
        <div className="pointer-events-none absolute inset-0 z-0">
          <SpeckleLayer seed="messages-list-hero" density="high" opacity={0.06} />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-12 z-0 opacity-[0.55]"
        >
          <SplatterAccent
            preset={splatterPreset}
            variant={2}
            size={300}
            rotate={-14}
          />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-10 left-32 z-0 opacity-40"
        >
          <SplatterAccent
            preset={splatterPreset}
            variant={0}
            size={170}
            rotate={28}
          />
        </div>

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Club admin · {clubName}
            </div>
            <h1 className="mt-1.5 font-display text-[44px] font-black italic leading-[1.05] tracking-tight">
              Messages
            </h1>
            <div className="mt-0.5 font-display text-[22px] font-bold italic text-ink-muted">
              broadcasts &amp; reminders
            </div>
            <p className="mt-2 max-w-[64ch] text-[14px] text-ink-muted">
              {subtitle}
            </p>
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span
                data-slot="channel-pill"
                className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary-500 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-on-primary"
              >
                <MessageSquare className="size-3" aria-hidden="true" />
                In-app · v1
              </span>
              {rows.length > 0 && (
                <span
                  data-slot="counts-pill"
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-bone px-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted"
                >
                  <Inbox className="size-3" aria-hidden="true" />
                  {draftCount} drafts · {failedCount} failed
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/manage/messages/new"
              data-slot="new-message-cta"
              className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary-500 px-5 text-sm font-semibold text-on-primary shadow-sm hover:bg-primary-600"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              New message
            </Link>
          </div>
        </div>
      </div>

      {/* INBOX / SENT TABS — URL-driven so notification deep links can target a tab */}
      <nav
        aria-label="Message folders"
        className="flex items-center gap-1 border-b border-border"
      >
        <Link
          href="/manage/messages?tab=inbox"
          data-slot="messages-tab"
          data-tab="inbox"
          aria-current={mode === "inbox" ? "page" : undefined}
          className={
            mode === "inbox"
              ? "inline-flex h-10 items-center border-b-2 border-primary-500 px-4 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-ink"
              : "inline-flex h-10 items-center px-4 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          }
        >
          Inbox
        </Link>
        <Link
          href="/manage/messages?tab=sent"
          data-slot="messages-tab"
          data-tab="sent"
          aria-current={mode === "sent" ? "page" : undefined}
          className={
            mode === "sent"
              ? "inline-flex h-10 items-center border-b-2 border-primary-500 px-4 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-ink"
              : "inline-flex h-10 items-center px-4 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          }
        >
          Sent
        </Link>
      </nav>

      {/* CLIENT ISLAND — filter chips + rows + empty state */}
      <MessagesListClient rows={rows} mode={mode} />
    </div>
  );
}
