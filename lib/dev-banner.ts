// Shared constants + helpers for the dev-only post-creation invite banner.
// Two separate sessionStorage keys because the writers + readers are on
// different surfaces and shouldn't collide:
//   • admin-invite banner — written by /platform/clubs/new wizard,
//     read by /platform/clubs/[id]
//   • player-invite banner — written by /manage/members invite modal,
//     read by /manage/members itself
// Same payload shape, same TTL, same gate.

export const DEV_INVITE_BANNER_KEY = "handibowls:dev-invite-banner";
export const DEV_PLAYER_INVITE_BANNER_KEY = "handibowls:dev-player-invite-banner";
export const DEV_INVITE_TTL_MS = 60 * 60 * 1000; // 60 minutes

// Custom-event name dispatched by writers (wizard, invite modal) after a
// successful sessionStorage update. The banner subscribes via
// useSyncExternalStore so a same-tab write is reflected without a navigation.
// sessionStorage's native StorageEvent only fires across tabs, hence this.
export const DEV_INVITE_BANNER_EVENT = "handibowls:invite-banner-update";

export type DevInviteBannerPayload = {
  clubId: string;
  inviteToken: string;
  expiresAt: number;
};

// Gate: production deploys MUST set NEXT_PUBLIC_APP_ENV=production. Belt-and-
// braces — if either knob says prod, the banner is off. Playwright's prod-
// build E2E server sets NEXT_PUBLIC_APP_ENV=test in .env.test so the banner
// path can be exercised end-to-end (without this opt-in the NODE_ENV=production
// baked into the client bundle by `next build` would silently disable it).
export function isDevBannerEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") return false;
  if (process.env.NEXT_PUBLIC_APP_ENV === "test") return true;
  return process.env.NODE_ENV !== "production";
}
