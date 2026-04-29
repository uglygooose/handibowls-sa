/// <reference lib="WebWorker" />
// Phase 8d — runtime caching strategies enabled. Phase 3 shipped the
// scaffold with `runtimeCaching: []`; this is the on-switch.
//
// Strategy map per the Phase-8 brief:
//
//   • Tournament list / detail / player home  →  StaleWhileRevalidate
//     The data changes (entries open, scores update) but a few-seconds-
//     stale render is fine because the next focus event triggers
//     a flush + revalidate. Faster perceived load, identical correctness.
//
//   • Scorecard route                         →  NetworkFirst (3s timeout)
//     Current state matters — the UI shows a stepper and end-by-end log
//     keyed off match_status + match_ends. Stale data here is a
//     correctness bug, not a perf nit. Fall back to cache only if the
//     network is unreachable.
//
//   • Static shell (Next assets, fonts, images) → default Serwist
//     precache. The /sw/route.ts handler stamps `additionalPrecacheEntries`
//     keyed off the HEAD commit SHA so a fresh build invalidates old
//     cached chunks naturally.
//
// Service-worker write queue is intentionally OMITTED. Phase 8d's
// outbox flush worker (lib/scorecard/use-outbox-flush.ts) handles
// scorecard writes from the client side via Server Actions. Routing
// the same writes through a sw-side BackgroundSyncPlugin would
// double-flush — the client-side path already retries on online +
// focus events.

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Scorecard route — NetworkFirst with a tight timeout. The match
    // Server Component reads matches table + match_ends; staleness here
    // affects in-progress match perception, so we want the fresh value.
    {
      matcher: ({ url, request }) =>
        request.destination === "document" &&
        /^\/tournaments\/[^/]+\/matches\/[^/]+$/.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: "scorecard-pages",
        networkTimeoutSeconds: 3,
      }),
    },
    // Tournament list + read-only detail. SWR — show whatever's cached
    // immediately, then revalidate in the background. Brackets +
    // standings tolerate a few seconds of staleness because the
    // scorecard surface owns "current state".
    {
      matcher: ({ url, request }) =>
        request.destination === "document" &&
        (url.pathname === "/tournaments" ||
          /^\/tournaments\/[^/]+$/.test(url.pathname) ||
          url.pathname === "/play"),
      handler: new StaleWhileRevalidate({
        cacheName: "tournaments-shell",
      }),
    },
    // Static + default — fall through to the package's default cache
    // rules (Next assets, image optimisation, fonts).
    ...defaultCache,
  ],
});

serwist.addEventListeners();
