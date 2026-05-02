// Phase 13 / 13-2b / Batch H1 — cross-user profile-display helper.
//
// POPIA's anonymise-not-delete pattern (migrations 043 / 044 / 045)
// preserves profile rows after hard-delete but NULLs the PII columns
// (first_name, last_name, display_name, email, phone, bsa_number,
// gender, date_of_birth, avatar_url). Cross-user surfaces that JOIN
// to profiles for name display need a consistent fallback so the UI
// renders "Deleted player" rather than empty / "Unknown" / "—".
//
// This helper is the single source of truth for the canonical
// fallback string. Used by data-layer name-formatting helpers
// (bookerName, nameOf, etc.) across 6 _data.ts files + lib/t20/
// assessment-detail.ts. NEVER use for self-rendering surfaces (the
// user's own /me header, profile setup) — the user always has their
// own PII so anonymisation isn't the question there.

export type PlayerNameInput = {
  first_name?: string | null;
  last_name?: string | null;
};

const DELETED_PLAYER = "Deleted player";

export function formatPlayerName(
  profile: PlayerNameInput | null | undefined,
): string {
  if (!profile) return DELETED_PLAYER;
  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  if (!first && !last) return DELETED_PLAYER;
  return [first, last].filter(Boolean).join(" ");
}
