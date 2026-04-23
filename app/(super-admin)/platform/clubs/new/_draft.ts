// Wizard draft persistence. Scope: the current tab session — losing a draft
// across tabs is fine, losing it on a mistaken tab-close is not. Lives in
// sessionStorage, not localStorage; sessionStorage dies with the tab.
//
// A 7-day TTL is written alongside the payload as belt-and-braces: a tab
// pinned open for weeks can otherwise hold a stale draft indefinitely.
// Expired drafts are silently discarded on read.

import type { WizardFormInput } from "./_schema";

export const WIZARD_DRAFT_KEY = "handibowls:new-club-wizard-draft";

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StoredDraft = {
  values: WizardFormInput;
  expiresAt: number;
};

export function readDraft(): WizardFormInput | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(WIZARD_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft | WizardFormInput;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "expiresAt" in parsed &&
      "values" in parsed
    ) {
      if (parsed.expiresAt < Date.now()) {
        window.sessionStorage.removeItem(WIZARD_DRAFT_KEY);
        return null;
      }
      return parsed.values;
    }
    // Legacy payloads (pre-TTL) — accept once, then rewrite on next save.
    return parsed as WizardFormInput;
  } catch {
    return null;
  }
}

export function writeDraft(values: WizardFormInput): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredDraft = {
      values,
      expiresAt: Date.now() + DRAFT_TTL_MS,
    };
    window.sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Storage can throw (quota, privacy mode). Silent — drafts are a
    // convenience, not a correctness feature.
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(WIZARD_DRAFT_KEY);
  } catch {
    // ignore
  }
}
