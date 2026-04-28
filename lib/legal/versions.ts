// Versioned legal documents. Bumping a version invalidates the matching
// consents row at (profile_id, kind, version) and forces a re-prompt on
// the next /me/setup pass. Migration 012's unique constraint enforces
// one row per (profile, kind, version).
//
// Marketing has its own version because marketing T&Cs can change
// independently of terms/privacy.

export const TERMS_VERSION = "1.0";
export const PRIVACY_VERSION = "1.0";
export const MARKETING_VERSION = "1.0";
