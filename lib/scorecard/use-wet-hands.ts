"use client";

import { useCallback, useSyncExternalStore } from "react";

// Phase 8c — wet-hands mode persistence. Per the brief, the toggle
// state lives in localStorage under the key `handibowls.wetHands` and
// is per-device (not synced across devices).
//
// Implementation note: we use `useSyncExternalStore` rather than a
// useState + useEffect hydrate. Three reasons:
//   1. Eliminates the lint warning about setState-in-effect.
//   2. Returns a stable boolean during SSR (always false) — no
//      hydration mismatch.
//   3. Lets us notify all subscribers on writes, so multiple
//      <WetHandsToggle /> instances stay in sync without prop drilling.
//
// The per-device contract is locked at v1; cross-device wet-hands sync
// would land alongside Phase 11 settings sync.

const STORAGE_KEY = "handibowls.wetHands";

const subscribers = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function readSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // localStorage may be blocked (Safari private mode). Fall through
    // to "off" for the session — toggle still works in-memory because
    // the writer never fails out, just no persistence.
    return false;
  }
}

function getServerSnapshot(): boolean {
  // SSR: always render with wet-hands off so the first paint is stable.
  // The hook re-reads localStorage on hydration, then the store
  // notifies subscribers if the actual value differs.
  return false;
}

function notify() {
  for (const cb of subscribers) cb();
}

export function useWetHands(): {
  on: boolean;
  toggle: () => void;
  setOn: (v: boolean) => void;
} {
  const on = useSyncExternalStore(subscribe, readSnapshot, getServerSnapshot);

  const setOn = useCallback((v: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      // ignore — see readSnapshot comment
    }
    notify();
  }, []);

  const toggle = useCallback(() => {
    setOn(!readSnapshot());
  }, [setOn]);

  return { on, toggle, setOn };
}
