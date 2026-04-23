"use client";

import { Check, Copy, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  DEV_INVITE_BANNER_KEY,
  isDevBannerEnabled,
  type DevInviteBannerPayload,
} from "../../new/_dev-banner";

type Props = { clubId: string };

// Snapshot cache keeps useSyncExternalStore's return reference stable when
// the underlying raw string is unchanged. React warns otherwise.
let cachedRaw: string | null = null;
let cachedParsed: DevInviteBannerPayload | null = null;

function readSnapshot(): DevInviteBannerPayload | null {
  if (typeof window === "undefined") return null;
  if (!isDevBannerEnabled()) return null;
  const raw = window.sessionStorage.getItem(DEV_INVITE_BANNER_KEY);
  if (raw === cachedRaw) return cachedParsed;
  cachedRaw = raw;
  if (!raw) {
    cachedParsed = null;
    return cachedParsed;
  }
  try {
    const parsed = JSON.parse(raw) as DevInviteBannerPayload;
    if (
      typeof parsed?.clubId !== "string" ||
      typeof parsed?.inviteToken !== "string" ||
      typeof parsed?.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now()
    ) {
      window.sessionStorage.removeItem(DEV_INVITE_BANNER_KEY);
      cachedParsed = null;
    } else {
      cachedParsed = parsed;
    }
  } catch {
    window.sessionStorage.removeItem(DEV_INVITE_BANNER_KEY);
    cachedParsed = null;
  }
  return cachedParsed;
}

// sessionStorage doesn't fire StorageEvent in the same tab; nothing to
// subscribe to. The snapshot is read once on mount.
const NOOP_SUBSCRIBE = () => () => {};
const getServerSnapshot = () => null;

// Renders only when:
//   • not production (NODE_ENV and NEXT_PUBLIC_APP_ENV both non-prod)
//   • a payload exists under DEV_INVITE_BANNER_KEY
//   • payload.clubId matches this page's clubId
//   • payload.expiresAt is still in the future
// Any mismatch clears the entry — tokens are credentials and shouldn't
// linger across sessions or leak to another club's detail page.
export function DevInviteBanner({ clubId }: Props) {
  const payload = useSyncExternalStore(
    NOOP_SUBSCRIBE,
    readSnapshot,
    getServerSnapshot,
  );
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
    window.sessionStorage.removeItem(DEV_INVITE_BANNER_KEY);
    cachedRaw = null;
    cachedParsed = null;
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
      <span>Admin invite link (valid for 60 minutes):</span>
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
