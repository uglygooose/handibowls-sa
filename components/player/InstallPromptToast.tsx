"use client";

import { Download, Share2, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// Phase 8f-2 — InstallPromptToast.
//
// Greenfield component (design source is silent on PWA install
// affordances; same pattern as the OpponentConfirmation /
// AwaitingOpponentConfirm / BookingSheet inventions where the design
// didn't model an infrastructure UX). Visual treatment borrows the
// `.notif-banner` shape from PagePlay's design source
// (`handibowls/project/player-core.jsx:136-140`): icon · headline ·
// body · trailing action.
//
// Trigger spec (Phase 8 step 6, line 708):
//   "Install prompt after 2nd successful load + 1st scorecard open."
//
// State machine in `localStorage` (lifetime — survives session close):
//   • loadCount         — incremented once per fresh mount of the
//                         player layout (gated by sessionStorage so
//                         StrictMode double-effects don't double-count)
//   • scorecardOpened   — set on first visit to a scorecard route
//   • dismissedAt       — ISO timestamp when user taps X; 14-day cooldown
//   • installedAt       — ISO timestamp from `appinstalled` event;
//                         permanent — never re-show
//
// Render paths (mutually exclusive):
//   • Android — capture `beforeinstallprompt`, stash event, show
//     "Install" button. On tap, call event.prompt() → userChoice.
//     If dismissed, write dismissedAt.
//   • iOS Safari — no native prompt API; render
//     "Tap Share → Add to Home Screen" instructional banner with
//     dismiss X only. Detected via iOS UA + (display-mode: standalone)
//     === false + navigator.standalone === false.
//
// Eligibility re-evaluates on every pathname change so the toast can
// appear immediately when scorecardOpened flips. Suppressed ON the
// scorecard route itself (would block scoring UI mid-end).

const STORAGE_KEYS = {
  loadCount: "handibowls.installprompt.loadCount",
  scorecardOpened: "handibowls.installprompt.scorecardOpened",
  dismissedAt: "handibowls.installprompt.dismissedAt",
  installedAt: "handibowls.installprompt.installedAt",
  // sessionStorage gate so StrictMode double-effects in dev don't double-count.
  loadIncrementedThisSession:
    "handibowls.installprompt.loadIncrementedThisSession",
} as const;

const COOLDOWN_DAYS = 14;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const MIN_LOADS = 2;
const SCORECARD_PATH_RE = /^\/tournaments\/[^/]+\/matches\/[^/]+$/;

// Augments Event with the Android-specific prompt() / userChoice members.
type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Mode = "android" | "ios" | null;

function isIosUserAgent(ua: string): boolean {
  // iPad on iOS 13+ identifies as Mac; a touch-capable Mac on a
  // non-Mac UA is the most reliable iPad detector. Keeping it simple
  // for the obvious devices first.
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  if (
    /macintosh/i.test(ua) &&
    typeof navigator !== "undefined" &&
    navigator.maxTouchPoints > 1
  ) {
    return true;
  }
  return false;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari exposes the legacy `standalone` property on navigator.
  // It's non-standard but still the canonical iOS standalone test.
  type IosNavigator = Navigator & { standalone?: boolean };
  if ((window.navigator as IosNavigator).standalone === true) return true;
  return false;
}

export function InstallPromptToast() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [eligible, setEligible] = useState(false);

  // Mount-time: increment loadCount + register window event listeners.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // sessionStorage gate — increment once per browser tab session,
    // not once per render. StrictMode dev re-runs are a no-op past
    // the first.
    if (!sessionStorage.getItem(STORAGE_KEYS.loadIncrementedThisSession)) {
      const current = Number(localStorage.getItem(STORAGE_KEYS.loadCount) ?? "0");
      localStorage.setItem(STORAGE_KEYS.loadCount, String(current + 1));
      sessionStorage.setItem(STORAGE_KEYS.loadIncrementedThisSession, "1");
    }

    function onBeforeInstallPrompt(e: Event) {
      // Default behaviour is the browser's mini-infobar; pre-empt so we
      // can render our own banner that ties in with the layout.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    function onAppInstalled() {
      try {
        localStorage.setItem(
          STORAGE_KEYS.installedAt,
          new Date().toISOString(),
        );
      } catch {
        // Private mode / storage quota — best-effort. Eligibility
        // collapses on this render anyway.
      }
      setEligible(false);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  // Pathname watcher — flip scorecardOpened when needed, recompute
  // eligibility, suppress on the scorecard route itself.
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (SCORECARD_PATH_RE.test(pathname)) {
      try {
        localStorage.setItem(STORAGE_KEYS.scorecardOpened, "1");
      } catch {
        // ignore — see appinstalled handler comment
      }
      setEligible(false);
      return;
    }

    // Read state.
    const loadCount = Number(
      localStorage.getItem(STORAGE_KEYS.loadCount) ?? "0",
    );
    const scorecardOpened =
      localStorage.getItem(STORAGE_KEYS.scorecardOpened) === "1";
    const dismissedAt = localStorage.getItem(STORAGE_KEYS.dismissedAt);
    const installedAt = localStorage.getItem(STORAGE_KEYS.installedAt);

    if (installedAt) {
      setEligible(false);
      return;
    }
    if (dismissedAt) {
      const ms = Date.now() - new Date(dismissedAt).getTime();
      if (ms < COOLDOWN_MS) {
        setEligible(false);
        return;
      }
    }
    if (loadCount < MIN_LOADS || !scorecardOpened) {
      setEligible(false);
      return;
    }
    if (isStandalone()) {
      // Already running as installed PWA — no need to prompt.
      setEligible(false);
      return;
    }

    if (deferredPrompt) {
      setMode("android");
      setEligible(true);
      return;
    }

    if (isIosUserAgent(window.navigator.userAgent)) {
      setMode("ios");
      setEligible(true);
      return;
    }

    setEligible(false);
  }, [pathname, deferredPrompt]);

  function handleDismiss() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.dismissedAt,
        new Date().toISOString(),
      );
    } catch {
      // ignore
    }
    setEligible(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "dismissed") {
        try {
          localStorage.setItem(
            STORAGE_KEYS.dismissedAt,
            new Date().toISOString(),
          );
        } catch {
          // ignore
        }
      }
      // 'accepted' is handled by the appinstalled listener writing
      // installedAt — no additional bookkeeping here.
    } finally {
      setDeferredPrompt(null);
      setEligible(false);
    }
  }

  if (!eligible || !mode) return null;

  return (
    <aside
      data-slot="install-prompt-toast"
      data-mode={mode}
      role="region"
      aria-label="Install HandiBowls"
      className={cn(
        "fixed inset-x-3 bottom-[calc(var(--player-bottom-nav-h,64px)+12px)] z-40",
        "mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-bone p-3",
        "shadow-[0_-8px_24px_-8px_rgba(10,10,10,0.25)]",
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-500/12 text-primary-500"
      >
        {mode === "ios" ? (
          <Share2 className="size-4" />
        ) : (
          <Download className="size-4" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <strong className="block text-[13.5px] font-extrabold text-ink">
          Install HandiBowls
        </strong>
        <p
          data-slot="install-prompt-body"
          className="text-[12px] text-ink-muted"
        >
          {mode === "ios"
            ? "Tap Share, then Add to Home Screen."
            : "Add to home screen for offline scoring."}
        </p>
      </div>

      {mode === "android" ? (
        <button
          type="button"
          onClick={handleInstall}
          data-slot="install-cta"
          className={cn(
            "flex h-9 shrink-0 items-center rounded-lg bg-primary-500 px-3",
            "text-[12px] font-extrabold uppercase tracking-[0.04em] text-on-primary",
            "shadow-sm hover:opacity-90",
          )}
        >
          Install
        </button>
      ) : null}

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
        data-slot="install-dismiss"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          "text-ink-muted hover:bg-surface-muted",
        )}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
