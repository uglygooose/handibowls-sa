"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Phase 8c — wake-lock hook for the scorecard surface. The browser-
// native Screen Wake Lock API keeps the device's screen awake while
// the player is mid-end. Two constraints govern the implementation:
//
//   1. iOS Safari requires a user gesture before `navigator.wakeLock
//      .request()` resolves. We expose `acquire()` separately from the
//      hook's auto-release lifecycle so the caller can wire it into
//      the first +/− tap rather than into useEffect.
//   2. The lock auto-releases when the page becomes hidden. We re-
//      acquire on visibility-back-to-visible if `intent` is still true.
//      Without this, switching tabs and switching back leaves the
//      screen sleeping again — a wet-hands UX failure.
//
// The hook returns a small state object: `active` (whether the lock is
// currently held), `acquire()` (call from a user gesture), and
// `release()` (manual release; usually unnecessary because unmount
// auto-releases via the cleanup).
//
// Browser support: Chrome / Edge / Safari 16.4+ / Firefox 126+.
// Older browsers fail silently — `acquire()` returns false and the
// scorecard renders without the badge.

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (event: "release", handler: () => void) => void;
  removeEventListener: (event: "release", handler: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

export type UseWakeLockResult = {
  /** True while the lock is currently held. Drives <WakeLockIndicator>. */
  active: boolean;
  /** True when the API isn't supported (no badge, no toast). */
  unsupported: boolean;
  /** Acquire the lock. Must be called from a user gesture (iOS Safari). */
  acquire: () => Promise<boolean>;
  /** Manual release. Auto-released on unmount + visibility change. */
  release: () => Promise<void>;
};

export function useWakeLock(): UseWakeLockResult {
  const [active, setActive] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  // Tracks user intent — we re-acquire on visibilitychange when this
  // is true, even if the browser auto-released the sentinel.
  const intentRef = useRef(false);

  const acquire = useCallback(async (): Promise<boolean> => {
    intentRef.current = true;
    if (typeof navigator === "undefined") return false;
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) {
      setUnsupported(true);
      return false;
    }
    if (sentinelRef.current) {
      // Already held — caller-side bookkeeping; nothing to do.
      return true;
    }
    try {
      const sentinel = await nav.wakeLock.request("screen");
      sentinelRef.current = sentinel;
      setActive(true);
      const onAutoRelease = () => {
        sentinelRef.current = null;
        setActive(false);
      };
      sentinel.addEventListener("release", onAutoRelease);
      return true;
    } catch {
      // Permission rejection or transient failure. Don't crash the
      // surface — the scorecard remains usable, just the screen will
      // sleep on iOS default timeout.
      return false;
    }
  }, []);

  const release = useCallback(async (): Promise<void> => {
    intentRef.current = false;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    try {
      await sentinel.release();
    } catch {
      // Already released — ignore.
    }
    sentinelRef.current = null;
    setActive(false);
  }, []);

  // Auto-release on unmount + re-acquire on visibility return.
  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === "visible" && intentRef.current) {
        // Best-effort re-acquire. iOS Safari may reject if the user-
        // gesture window has lapsed; that's OK — the scorecard's next
        // +/− tap will re-acquire.
        void acquire();
      }
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisChange);
      // Synchronous cleanup — sentinel.release() is async but we don't
      // need to await it on unmount.
      void release();
    };
  }, [acquire, release]);

  return { active, unsupported, acquire, release };
}
