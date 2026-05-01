"use client";

import dynamic from "next/dynamic";

// Phase 12 / 12-5: lazy-mount wrapper for DynamicSyncBadge. The
// badge itself is a Client Component that imports the Dexie outbox
// hooks (useOutboxFlush + useSyncState) which transitively pull in
// `dexie` (~95KB). Layout-level static-import dragged that chunk
// onto every player route's Client Component graph (per
// scripts/route-bundle-audit.mjs baseline at 12-5 open: dexie=YES
// on /play /book /tournaments /me).
//
// The fix: keep the badge mounted on every player route (the live
// "queued / error" state matters off-scorecard too — players
// notice when an offline scorecard hasn't flushed) but defer its
// chunk load to first hydration via `next/dynamic({ ssr: false })`.
// dexie now ships in a deferred chunk that fetches alongside the
// badge hydration, off the initial paint critical path.
//
// The placeholder is OfflineSyncBadge-sized (h-7 + ~52px width with
// the "Synced" label) so swap-in doesn't trigger a layout shift in
// the TopBar action row.

const DynamicSyncBadge = dynamic(
  () =>
    import("./DynamicSyncBadge").then((m) => ({
      default: m.DynamicSyncBadge,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="inline-flex h-7 w-[52px] rounded-full"
      />
    ),
  },
);

export function DynamicSyncBadgeMount() {
  return <DynamicSyncBadge />;
}
