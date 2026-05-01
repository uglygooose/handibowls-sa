// Phase 12.5 / 12.5-6 (L / `icon-stroke-scale`) — locked icon size +
// stroke tier for lucide-react consumers across all admin / player /
// auth surfaces. Marketing surfaces (`app/(marketing)/`) are exempt
// per the locked decision: `IconArrow` / `IconTournament` /
// `IconScore` / `IconCompass` are bespoke landing icons that keep
// their existing strokes + sizes as a brand-differentiator.
//
// Scale (sub-pixel values are the Tailwind `size-N` mapping; `size-3`
// = 0.75rem = 12px, `size-3.5` = 14px, `size-4` = 16px, `size-5` =
// 20px, `size-6` = 24px):
//
//   pill (12px / size-3)        — icons inside <span class="pill">
//                                 status badges. NOT in the user-spec
//                                 4-step scale because pill-internal
//                                 is its own context; the design
//                                 source bundle uses 12px on every
//                                 pill icon (e.g. t20-page-list.jsx
//                                 active-rubric pill).
//   inline (14px / size-3.5)    — icons sitting inline with body text
//                                 (chip rows, breadcrumbs).
//   heading (16px / size-4)     — icons sitting inline with section
//                                 headings or paragraph-leading
//                                 indicators.
//   nav (20px / size-5)         — icons in nav rails (AdminSidebar,
//                                 PlayerBottomNav) + primary buttons
//                                 (`btn btn-lg` height).
//   hero (24px / size-6)        — hero / metric icons (SectionHead
//                                 trophies, stat-card accents).
//
// Stroke:
//
//   default (2)                 — lucide library default; applies
//                                 unless the consumer overrides.
//   active (2.5)                — only on `aria-current="page"`
//                                 navigation items + active tab
//                                 indicators. Drift back to default
//                                 stroke on these items reads as a
//                                 hover/selection-state regression.

export const ICON_SIZE = {
  pill: 12,
  inline: 14,
  heading: 16,
  nav: 20,
  hero: 24,
} as const;

export type IconSizeKey = keyof typeof ICON_SIZE;

export const ICON_STROKE = {
  default: 2,
  active: 2.5,
} as const;

/** All Tailwind `size-N` values legal for lucide icon consumers. Test
 *  helpers + lint guards reference this list; drift back to e.g.
 *  `size-[18px]` on AdminSidebar will fail the icon-scale audit. */
export const LEGAL_ICON_SIZE_TOKENS: ReadonlySet<string> = new Set([
  "size-3", // 12px
  "size-3.5", // 14px
  "size-4", // 16px
  "size-5", // 20px
  "size-6", // 24px
]);
