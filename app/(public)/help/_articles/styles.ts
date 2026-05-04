// Phase 13 / 13-6 / Batch B — shared prose typography constants for
// the four /help articles. Mirrors the rhythm used by /privacy and
// /terms (ml-5 / mt-2 lists, underline-offset-3 ink-decorated links)
// but centralises the strings so the four article components stay
// uniform without repeating literals.

export const PROSE_H2 =
  "mt-7 font-display text-[22px] font-extrabold italic tracking-tight";

export const PROSE_UL =
  "ml-5 mt-2 flex list-disc flex-col gap-2 text-[15px] leading-[1.6]";

export const PROSE_LINK =
  "font-medium text-ink underline underline-offset-[3px] decoration-border hover:decoration-ink";
