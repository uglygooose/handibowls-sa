// Shared constants + helpers for the dev-only post-creation invite banner.
// Keeping these in one place so the writer (wizard publish path) and the
// reader (club detail page) can't drift on key name or TTL.

export const DEV_INVITE_BANNER_KEY = "handibowls:dev-invite-banner";
export const DEV_INVITE_TTL_MS = 60 * 60 * 1000; // 60 minutes

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
