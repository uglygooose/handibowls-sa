/// <reference lib="WebWorker" />
// Service worker entry. Phase 3: precache only; no runtime caching strategies.
// Phase 8 introduces runtime caching (NetworkFirst for Supabase, StaleWhileRevalidate
// for static shell, CacheFirst for fonts/images).

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

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
  // Phase 3 placeholder — runtime routes enabled in Phase 8. The import of
  // defaultCache above keeps the reference alive so typecheck surfaces any
  // serwist API drift between phases.
  runtimeCaching: [],
});

// Suppress unused-import error without dropping the API reference.
void defaultCache;

serwist.addEventListeners();
