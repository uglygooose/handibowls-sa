// Wizard draft persistence. Scope: the current tab session — losing a draft
// across tabs is fine, losing it on a mistaken tab-close is not. Lives in
// sessionStorage, not localStorage; no TTL needed because sessionStorage
// dies with the tab.

import type { WizardFormValues } from "./_schema";

export const WIZARD_DRAFT_KEY = "handibowls:new-club-wizard-draft";

export function readDraft(): WizardFormValues | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(WIZARD_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WizardFormValues;
  } catch {
    return null;
  }
}

export function writeDraft(values: WizardFormValues): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(values));
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
