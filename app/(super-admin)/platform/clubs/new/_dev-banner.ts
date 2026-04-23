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

// Gate: must not be production, must not be a Vercel preview deploy running
// in production mode. Caller-safe (returns false in both cases).
export function isDevBannerEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") return false;
  return true;
}
