"use client";

import { Check, Copy, X } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  DEV_INVITE_BANNER_EVENT,
  DEV_INVITE_BANNER_KEY,
  isDevBannerEnabled,
  type DevInviteBannerPayload,
} from "@/lib/dev-banner";

type Props = {
  clubId: string;
  // Defaults preserve the original admin-invite shape used by /platform/clubs/[id].
  // /manage/members passes its own key + label to surface player invites.
  storageKey?: string;
  label?: string;
};

// Snapshot cache keyed by sessionStorage key — keeps useSyncExternalStore's
// return reference stable when the underlying raw string is unchanged. React
// warns otherwise. Per-key entries so two banners (admin + player) cache
// independently if they ever co-mount.
type CacheEntry = { raw: string | null; parsed: DevInviteBannerPayload | null };
const cache = new Map<string, CacheEntry>();

function makeReader(storageKey: string) {
  return function readSnapshot(): DevInviteBannerPayload | null {
    if (typeof window === "undefined") return null;
    if (!isDevBannerEnabled()) return null;
    const raw = window.sessionStorage.getItem(storageKey);
    const cached = cache.get(storageKey) ?? { raw: null, parsed: null };
    if (raw === cached.raw) return cached.parsed;

    let parsed: DevInviteBannerPayload | null = null;
    if (raw) {
      try {
        const candidate = JSON.parse(raw) as DevInviteBannerPayload;
        if (
          typeof candidate?.clubId === "string" &&
          typeof candidate?.inviteToken === "string" &&
          typeof candidate?.expiresAt === "number" &&
          candidate.expiresAt > Date.now()
        ) {
          parsed = candidate;
        } else {
          window.sessionStorage.removeItem(storageKey);
        }
      } catch {
        window.sessionStorage.removeItem(storageKey);
      }
    }
    cache.set(storageKey, { raw, parsed });
    return parsed;
  };
}

// sessionStorage doesn't fire StorageEvent in the same tab. Writers (wizard,
// invite modal) dispatch a CustomEvent after each write so the banner can
// re-read without a navigation. Cross-tab updates aren't a concern — the
// banner is dev-only.
function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(DEV_INVITE_BANNER_EVENT, callback);
  return () => window.removeEventListener(DEV_INVITE_BANNER_EVENT, callback);
}
const getServerSnapshot = () => null;

// Renders only when:
//   • not production (NODE_ENV and NEXT_PUBLIC_APP_ENV both non-prod)
//   • a payload exists under storageKey
//   • payload.clubId matches this page's clubId
//   • payload.expiresAt is still in the future
// Any mismatch clears the entry — tokens are credentials and shouldn't
// linger across sessions or leak to another club's detail page.
export function DevInviteBanner({
  clubId,
  storageKey = DEV_INVITE_BANNER_KEY,
  label = "Admin invite link (valid for 60 minutes):",
}: Props) {
  const reader = useMemo(() => makeReader(storageKey), [storageKey]);
  const payload = useSyncExternalStore(subscribe, reader, getServerSnapshot);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!payload || payload.clubId !== clubId || dismissed) return null;

  const url = `${window.location.origin}/invite/${payload.inviteToken}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be blocked; the URL is visible in the DOM so
      // the user can select-and-copy manually.
    }
  };

  const handleDismiss = () => {
    window.sessionStorage.removeItem(storageKey);
    cache.delete(storageKey);
    setDismissed(true);
  };

  return (
    <div
      data-testid="dev-invite-banner"
      role="status"
      className="mx-6 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-amber-800">
        Dev only
      </span>
      <span>{label}</span>
      <code
        data-testid="dev-invite-banner-url"
        className="flex-1 min-w-[220px] truncate rounded-md border border-amber-500/30 bg-background px-2 py-1 font-mono text-xs"
      >
        {url}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        data-testid="dev-invite-banner-copy"
      >
        {copied ? (
          <>
            <Check className="mr-1 h-3 w-3" /> Copied
          </>
        ) : (
          <>
            <Copy className="mr-1 h-3 w-3" /> Copy
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-md"
        aria-label="Dismiss invite banner"
        onClick={handleDismiss}
        data-testid="dev-invite-banner-dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
