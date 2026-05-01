/* Phase 12.5 audit data — system findings + per-entry briefs.
   Treated as the single source of truth for the audit document. */
window.AUDIT = {
  meta: {
    phase: "12.5",
    branch: "rebuild/phase-12-stakeholder-polish",
    cutFrom: "555ea83",
    referenceSurfaces: [
      { name: "Player /t20 hub", file: "player-pages.jsx :: PageT20", phase: "12-1" },
      { name: "Admin /manage/t20/[id] results", file: "t20-page-results.jsx", phase: "10" },
      { name: "Showcase landing", file: "landing.jsx", phase: "1 + 11" },
    ],
  },

  /* ===== System-level audit summary across the 9 dimensions ===== */
  system: [
    {
      id: "type",
      title: "Typography hierarchy",
      onPoint: [
        "Display headings on landing — Barlow Condensed-style, 900-weight italic, tight tracking. Used in `Hero.tsx`, `ShowcaseT20.tsx`, `t20-page-results.jsx` hero.",
        "Eyebrow / kicker pattern — uppercase, 11–12px, 0.12–0.16em tracking, ink-muted. Consistent on landing + admin t20 results.",
        "Tabular numerics on score / percentage — `tabular` class is applied wherever scores live (player scorecard, t20 hero, ends grid).",
      ],
      drift: [
        "Player surfaces use `font-mono` for eyebrows in some places (`player-pages.jsx`) and `font-display` in others. The reference admin t20 view uses `eyebrow` class — there is no equivalent player class declared.",
        "`StubPage` (greens, members, overview, messages, etc.) uses generic Tailwind type sizing rather than the design-system display/eyebrow tokens. These are placeholder routes — drift will solidify when they are built out.",
        "Hero h1 size on landing differs from design source: shipped uses `clamp(52px,8vw,112px)` ; design-source `landing.jsx` ships a tighter scale. Acceptable, but the line-height (0.88) does not match the player /t20 grade tile (1.0). Same family, mismatched leading.",
        "Body text scale floats: 13.5px (admin t20 notes), 14px (player section copy), 15px (admin section heads), 17px (showcase body), 20px (hero sub). No declared body-step token.",
      ],
      unifiedSpec: [
        "Adopt three explicit roles: `display` (Barlow Condensed 900 italic, leading 0.9), `body` (16/1.5), `mono-eyebrow` (JetBrains Mono 700 12px / 0.14em uppercase ink-muted).",
        "Codify a 4-step body scale: 13 / 15 / 17 / 20. Anything outside the scale is drift.",
        "Eyebrow class becomes the single canonical tag — used everywhere a kicker label appears. Replace ad-hoc `font-mono` + manual tracking with `<span class=\"eyebrow\">…</span>` (or shadcn-equivalent wrapper) on player surfaces.",
      ],
    },
    {
      id: "spacing",
      title: "Spacing rhythm",
      onPoint: [
        "Card padding on admin t20 results (24px x-axis, 18–22px y-axis) matches landing showcase card padding (24px). Good rhythm.",
        "Section gap on landing is 100px desktop, 64px mobile — consistent across `ShowcaseTournament` and `ShowcaseT20`.",
      ],
      drift: [
        "Player section-head margin: not bound to a token. `<div className=\"section-head\">` reuses `player-styles.css` legacy values which differ from admin's 18px-top/14px-bottom.",
        "Card border-radius drifts: 10 (coach notes inner), 12 (most cards), 14 (sticker), 20 (compass card border), 24 (t20 hero). Five values where two would suffice.",
        "Admin sidebar uses 11px row height (`h-11` Tailwind = 44px), player bottom-nav uses 64px (`h-16`). Different — but defensible by mobile vs desktop.",
        "Form input height not pinned: auth `Field.tsx` ships shadcn default 36px, booking `slot` button is 38px, `btn-md` in design-source is 40px.",
      ],
      unifiedSpec: [
        "Container padding scale: 14 / 18 / 24 / 32. Lock cards to 24-x / 18–22-y; only the t20 reveal hero gets 40-x / 44-y.",
        "Radius scale: 10 (chip / inset), 14 (card default), 20 (hero / brand surface), 24 (reveal hero only). Delete 12.",
        "Form-control height: pin to 40 (`h-10`) for default, 44 for primary CTA, 48 for mobile-block. The 36px shadcn default is the drift, not the spec.",
      ],
    },
    {
      id: "primitives",
      title: "Component primitives",
      onPoint: [
        "Card / Button / Input wrappers exist as shadcn primitives in `components/ui/`. Auth forms wire into them cleanly.",
        "Pill component pattern is consistent: pill (neutral), pill-primary, pill-info, pill-success, pill-warning. Used identically in player and admin.",
      ],
      drift: [
        "Tab pattern forks. Admin uses shadcn `<Tabs>` (`components/ui/tabs.tsx`). Player /me/inbox uses `tab-bar` + `tab-btn` from `player-styles.css`. Same intent, two implementations.",
        "Empty-state pattern is unspecified. `StubPage` is the closest thing — but it ships a phase tag (\"Phase 5\"), which is dev-time chrome leaking into the visual contract. Rubrics page, inbox empty (coach with no captures), `/manage/messages` Sent-tab empty all need a real shared `EmptyState` primitive.",
        "Toast: `components/ui/sonner.tsx` exists; nothing in shipped surfaces invokes it. Capture-wizard cancel-with-confirmation (drift entry) is a Dialog use, not a Toast use.",
        "Button arbitrary variants: auth `Checkbox.tsx` uses `peer-checked:[&>svg]:opacity-100` (logged in DRIFT_LOG already). Same anti-pattern not yet caught in `SubmitButton.tsx` loading state.",
      ],
      unifiedSpec: [
        "One Tabs component (shadcn) with two skins via prop: `desktop` (current admin) and `mobile-bar` (current player). Migrate `tab-bar`/`tab-btn` to a wrapper that consumes the same primitive.",
        "Ship `<EmptyState icon eyebrow title body cta />` in `components/layout/`. All four current empty states (StubPage, rubrics, t20 list coach-no-captures, messages Sent-empty) consume it.",
        "Forbid arbitrary peer-/group- selectors in `components/ui/`. Replace with shadcn's data-state idiom or wrap the primitive.",
      ],
    },
    {
      id: "speckle",
      title: "Speckle / splatter treatment",
      onPoint: [
        "`SpeckleField` and `SpeckleLayer` are real, theme-aware, and use mulberry32 PRNG keyed on input. Density / opacity ramps work.",
        "Splatter is consistent on landing (`SplatterAccent` variants 0/1/2) and matches the admin t20 hero (`SA_r variant={a.grade==='gold'?2:1}`).",
      ],
      drift: [
        "**SpeckleField per-instance seed** is the single biggest open drift. `patternId = speckle-field-${p.id}-${density}-${opacityScale}` — does not include a seed. Two adjacent feature-grid cards with the same preset render an identical pattern; one of three variations the design promised collapses into one.",
        "Player /t20 hero uses `opacityScale={1.4}` and `density={1.3}`; landing feature card uses `density={1.2}`; auth aside uses defaults (1.0 / 1.0). Three different speckle intensities, no documented step.",
        "Admin sidebar speckle (`opacity={0.06}`) differs from invite background (`opacity` not declared, takes default 0.08). Consistent intent, accidental drift.",
      ],
      unifiedSpec: [
        "Add `seedKey?: string` prop to `SpeckleField`. `patternId` becomes `speckle-field-${p.id}-${density}-${opacityScale}-${seedKey ?? 'default'}`. Document: every render-site within the same viewport must pass a unique seedKey.",
        "Three intensity steps codified: `subtle` (density 1.0, opacity 1.0), `medium` (1.2 / 1.2), `bold` (1.3 / 1.4). All consumers pick one — no inline numbers.",
        "Splatter usage rule: at most one splatter per visual region; variant is content-driven (gold = variant 2, all others = variant 1) not random.",
      ],
    },
    {
      id: "theme",
      title: "Theme tokens",
      onPoint: [
        "`identity.decorPreset` flow exists; `ThemeApplier.tsx` writes `--primary-*` / `--speckle-*` / `--on-primary` from `theme-presets.ts`.",
        "Auth surfaces, admin sidebar, player /t20 hero all consume `var(--primary-500)` rather than hex literals. The pipeline holds for shipped chrome.",
      ],
      drift: [
        "Hex literals in `t20-page-results.jsx` heroBg gradient: `#f5cf52`, `#d4a000`, `#8a6300` (gold), `#c08758` (bronze), `#2a2a28` (fail). Grade colours intentionally not theme-tied — fine, but they should live in a `lib/brand/grade-colors.ts` constant, not inline at the call site.",
        "Showcase T20 grade-D row uses `bg-[#F5B700]` — same grade-C colour; declare once.",
        "Player /play, /me/inbox grade pills do not exist yet (PageT20 in design source uses `t20-grade` raw text). When implemented, must consume the same grade-color constants used by the admin view.",
      ],
      unifiedSpec: [
        "Move grade colours into `components/brand/grade.ts` exporting `GRADE_COLORS` keyed by `gold | silver | bronze | retry | ungraded`. Both `<GradePill>` and any hero gradient consume it.",
        "Codify: only grade-tier decoration may use non-theme hex. Everything else through `--primary-*` / `--speckle-*` / `--ink-*`.",
      ],
    },
    {
      id: "icons",
      title: "Iconography",
      onPoint: [
        "lucide-react used uniformly on admin (`AdminSidebar.tsx`) and player (`PlayerBottomNav.tsx`).",
        "Trailing `<IconArrow>` on CTAs is a recognisable brand cue on landing. Mirrored by `PIc.ArrowR` on player buttons.",
      ],
      drift: [
        "Stroke width inconsistent. Landing `IconArrow` uses 2.2; lucide default is 2; admin sidebar active item uses `stroke-[2.5]`. Three weights.",
        "Icon size discipline drifts: player uses 13/14/15/16/18 in different places (`<PIc.ArrowR size={13}/>` next to `<PIc.Trophy size={16}/>`). Pick a 4-step scale.",
        "Custom-drawn icons in `landing.jsx` (IconTournament, IconScore, IconCompass) duplicate work lucide already provides (`Trophy`, `Target`, `Compass`). Either commit to bespoke or migrate to lucide.",
      ],
      unifiedSpec: [
        "Stroke 2 everywhere; 2.5 only on aria-current item. Drop the 2.2 in `IconArrow` and remove bespoke landing icons in favour of lucide equivalents.",
        "Icon-size scale: 14 (inline w/ body), 16 (inline w/ heading), 20 (button / nav), 24 (hero / metric). Forbid sizes outside the scale.",
      ],
    },
    {
      id: "empty",
      title: "Empty / loading / pending states",
      onPoint: [
        "Skeleton primitive exists (`components/ui/skeleton.tsx`) — shadcn default.",
      ],
      drift: [
        "Inbox empty / Sent empty / coach-no-captures / rubrics page / tournament-edit (missing) — all deferred. None of them are designed yet.",
        "\"ALL SAVED\" affordance on the t20 capture wizard has no shipped equivalent. Player scorecard relies on offline-queue toast (not built).",
        "Loading state uses `loading.tsx` files at route level — they fire an unstyled spinner. No correspondence with the `Skeleton` primitive.",
      ],
      unifiedSpec: [
        "`<EmptyState>` primitive (see Components item) covers all empty surfaces.",
        "Pending-save indicator: tiny ink-muted `ALL SAVED` mono label top-right of any form-bearing surface, debounced 600ms after last save. Same component on capture wizard, t20 results notes editor, message composer.",
        "Each `loading.tsx` renders a Skeleton tree shaped like the route's page (matched grid, matched heights). Rule: no spinner-only loading states.",
      ],
    },
    {
      id: "responsive",
      title: "Mobile vs desktop responsive behaviour",
      onPoint: [
        "Architecture is right: player has a bottom-nav + 16px gutter mobile shell; admin has a sidebar + grid desktop shell.",
        "Responsive breakpoints respected on landing (`md:` consistent throughout `Hero.tsx`).",
      ],
      drift: [
        "Admin t20 results view (`t20-page-results.jsx`) uses `gridTemplateColumns:\"1.2fr 1fr 1fr\"` for charts — no mobile fallback. On <900px the heatmap, hand-balance, and length charts will collapse painfully.",
        "Player /me/inbox tab-bar is fixed-position-aware but the underlying notif-list scroll container is not; long unread lists clip behind the bottom-nav.",
        "Showcase landing hero stickers (`top-10 left-2.5`, `right-5 bottom-[140px]`) are absolute-pixel placed and overlap the headline at 360–400px viewport widths.",
      ],
      unifiedSpec: [
        "Admin t20 results charts: `md:grid-cols-3` on desktop, `grid-cols-1` <900px, with chart cards stacking full-width.",
        "Player scroll container: `padding-bottom: calc(env(safe-area-inset-bottom) + 80px)` on every `mcontent` so bottom-nav never overlaps content.",
        "Hero stickers: switch to `clamp()`-positioned percentages so they stay clear of headline at narrow viewports, or hide stickers <480px.",
      ],
    },
    {
      id: "copy",
      title: "Copywriting / terminology",
      onPoint: [
        "BSA terminology — \"Twenty 20\" is canonical in user-facing copy. Confirmed in admin sidebar (`label: \"T20\"` is the abbreviated nav label, full term used on detail pages).",
        "Player bottom-nav exception is locked: \"20/20\" — pinned by test, codified in `bsa-terminology` skill.",
      ],
      drift: [
        "Compass-card grade legend wording drift (logged): design has \"A · On the jack / B · In zone / C · Off zone / D · No bowl\"; shipped has \"A — dead weight to the jack / B — hugs the zone / C — in the head / D — off the rink\".",
        "Compass-card metadata drift (logged): design `BSA T20 · DRAW SHOT / END 4 OF 20 / 82%` vs shipped `STATION 3 · DRAW TO JACK / END 4 OF 6` (no percentage).",
        "Hero headline drift (logged): two competing variants in the design source vs shipped. Decide-at-polish.",
        "\"Tournaments\" vs \"Tourneys\" (player nav) — player nav uses \"Tourneys\" for fit; copy is consistent with the 76px tab-width discipline that gives the 20/20 exception.",
      ],
      unifiedSpec: [
        "Adopt BSA-aligned compass legend across landing, player /t20, admin t20 capture, admin t20 results: `A · On the jack / B · In zone / C · Off zone / D · No bowl`.",
        "Compass metadata: `BSA T20 · DRAW SHOT / END N OF 20 / NN%` — running percentage required.",
        "Hero headline: pick `TAP WHERE IT FINISHED. ZONES, GRADES, PERCENTAGES — HANDLED.` — closer to the BSA-T20 vocabulary the rest of the product uses. Drop the `EIGHT ZONES` variant.",
      ],
    },
  ],

  /* ===== Per-entry briefs ===== */
  entries: [
    /* --- Drift backlog (logged) --- */
    {
      id: "speckle-seed",
      reference: "DRIFT_LOG · SpeckleField per-instance seed missing",
      surface: "components/brand/SpeckleField.tsx",
      severity: "high",
      group: "Brand surfaces",
      intent: "Two adjacent cards with the same preset must not share the same speckle pattern. Each render must seed its own dot field.",
      visual: "Compare landing FeatureGrid (3 cards: ocean-blue, atomic-red, sunburst — currently all different presets, so drift is masked) against any future grid that repeats a preset (e.g. members-list club tiles) — patterns will collide.",
      impl: [
        "Add `seedKey?: string` to `Props` in `components/brand/SpeckleField.tsx`.",
        "Update `patternId` to include `seedKey ?? 'default'`.",
        "Update `generatePatternDots` callsite to pass `${patternId}` (already does — change is to the id derivation).",
        "Audit all current call sites; pass `seedKey` distinct per visual region (e.g. `seedKey={`feature-${i}`}` in FeatureGrid).",
      ],
      open: [
        "Should `seedKey` be required for non-fluid (`<svg>`-stretched) renders? Probably yes; document in the type.",
      ],
    },
    {
      id: "compass-wedge-labels",
      reference: "DRIFT_LOG · T20 compass card — wedge labels missing",
      surface: "app/(marketing)/_sections/ShowcaseT20.tsx · Compass()",
      severity: "med",
      group: "Landing",
      intent: "Each of 8 wedges shows a compass label (N / NE / E / SE / S / SW / W / NW) plus its grade letter (A/B/C/D), as in `landing.jsx :: Compass()` in the design source.",
      visual: "Match `landing.jsx :: Compass`: position labels at radius 0.68×R, two stacked text elements per wedge — display-font 18px for compass label, mono 11px for grade.",
      impl: [
        "Replicate `zones` array from `landing.jsx`.",
        "Inside the segments map, compute mid-angle and place two `<text>` elements (already in design source).",
        "Drop the outer-ring `N/E/S/W` labels — they duplicate what's now inside.",
      ],
      open: [],
    },
    {
      id: "compass-legend-wording",
      reference: "DRIFT_LOG · T20 compass card — grade legend wording drifted",
      surface: "app/(marketing)/_sections/ShowcaseT20.tsx",
      severity: "low",
      group: "Landing",
      intent: "Use BSA-aligned wording: `A · On the jack / B · In zone / C · Off zone / D · No bowl`.",
      visual: "Identical layout to the current legend; only the strings change.",
      impl: [
        "Replace the four `label:` strings in the grade legend `[…].map`.",
        "Mirror the change at the player /t20 hub when grade legend is added there (Phase 12.5 only if it ships in this pass).",
      ],
      open: [],
    },
    {
      id: "compass-metadata-drift",
      reference: "DRIFT_LOG · T20 compass card — metadata drifted",
      surface: "app/(marketing)/_sections/ShowcaseT20.tsx",
      severity: "low",
      group: "Landing",
      intent: "Header reads `BSA T20 · DRAW SHOT` (eyebrow), title `End 4 of 20`, badge `82%` running percentage.",
      visual: "Three-element header per `landing.jsx :: ShowcaseT20`. Badge is a high-contrast pill in primary-on-white treatment.",
      impl: [
        "Update the `<header>` block: eyebrow `BSA T20 · DRAW SHOT`, title `End 4 of 20`, replace the `A` letter with a `82%` badge.",
        "Move the `A` grade indicator down into the legend — it's no longer the focal point in this card.",
      ],
      open: [
        "If we want the per-card percentage live (driven by data), expose it via prop. Otherwise hard-code.",
      ],
    },
    {
      id: "topnav-pill-vs-text",
      reference: "DRIFT_LOG · Top nav system — pill vs text-links",
      surface: "app/(marketing)/_sections/LandingTopBar.tsx",
      severity: "low",
      group: "Landing",
      intent: "Decide-at-polish: pill-style nav (`LANDING / LOGIN / SIGNUP / INVITE`) **only** if the surfaces it points to are public auth surfaces. The current `Features / Tournaments / T20 / Clubs` text-links is a marketing-page IA, which is the more honest mapping for `app/page.tsx`.",
      visual: "Recommend keeping the text-links nav (current shipped) and rejecting the design-source pill-nav as outdated. The pill-nav assumed an SPA prototype; the shipped landing is a real marketing page.",
      impl: [
        "No change recommended. Mark this drift entry **closed (rejected)** with rationale: SPA prototype context not relevant to shipped marketing page.",
      ],
      open: [
        "User: agree to close this without change?",
      ],
    },
    {
      id: "hero-headline-decide",
      reference: "DRIFT_LOG · Hero heading wording",
      surface: "app/(marketing)/_sections/Hero.tsx",
      severity: "low",
      group: "Landing",
      intent: "Pick one of: (A) `EIGHT ZONES. ONE JACK. PROOF YOU'RE IMPROVING.` — current shipped, T20-centric. (B) `TAP WHERE IT FINISHED. ZONES, GRADES, PERCENTAGES — HANDLED.` — design source.",
      visual: "Recommend (B). \"Tap where it finished\" reads as instruction (active), while the current shipped opens with a number-claim that's only meaningful to bowlers who already know the T20 sheet.",
      impl: [
        "Replace `<h1>` content in `Hero.tsx` with the new wording.",
        "Adjust break points: the long second sentence wants its own visual line; consider `<br/>` after `IT FINISHED.`.",
      ],
      open: [
        "User pick: A or B?",
      ],
    },
    {
      id: "auth-checkbox-arbitrary",
      reference: "DRIFT_LOG · Checkbox arbitrary variant",
      surface: "app/(auth)/_components/Checkbox.tsx",
      severity: "med",
      group: "Auth",
      intent: "Use shadcn `<Checkbox>` primitive (`components/ui/checkbox.tsx`) directly. No bespoke `peer-checked:[&>svg]:opacity-100` selectors.",
      visual: "Identical visual outcome — the shadcn primitive ships the same checked-tick treatment via `data-state=\"checked\"`.",
      impl: [
        "Delete `app/(auth)/_components/Checkbox.tsx`.",
        "Replace consumers with `import { Checkbox } from \"@/components/ui/checkbox\"`.",
        "If the auth styling needs an outline-on-bone variant the primitive doesn't ship, add it via `class=\"data-[state=checked]:bg-primary-500\"` rather than peer selectors.",
      ],
      open: [],
    },
    {
      id: "speckle-pocket-hex-drift",
      reference: "DRIFT_LOG · Hero pocket highlight ~2% hex drift",
      surface: "app/(marketing)/_sections/Hero.tsx",
      severity: "low",
      group: "Landing",
      intent: "Match the design preview's exact pocket-highlight rgba.",
      visual: "Current shipped uses `bg-primary-500 opacity-[0.14]` skewed 8deg; design preview specifies a slightly different alpha.",
      impl: [
        "Trivial: tune `opacity-[0.14]` to `opacity-[0.16]` after eyeballing against the design preview.",
        "Mark as **closed (no-op)** unless side-by-side reveals visible drift.",
      ],
      open: [
        "Probably not worth a commit — close as no-op.",
      ],
    },

    /* --- Phase 12 surfaces (admin chrome / player surfaces / t20 capture) --- */
    {
      id: "player-t20-results-detail",
      reference: "Phase 12 highlight · Player Twenty 20 results detail view",
      surface: "app/(player)/t20/[assessmentId]/page.tsx (NEW)",
      severity: "high",
      group: "Player Twenty 20",
      intent: "A read-only player-facing variant of the admin t20 results view. Player taps a past-assessment row in `PageT20` and lands here.",
      visual: [
        "**Hero** — same grade reveal hero as the admin view. Grade pill, percentage, assessor name, date, rubric. No `Edit` action; replace `Schedule next` admin CTA with `Request re-assessment` (wired to in-app message → admin).",
        "**Section breakdown** — same table as admin, but read-only. Drop the `Edit` affordance on rows; keep R1/R2/Total/% columns.",
        "**Coach notes tiles** — the three categorised tiles (Strengths / Watch / Coach focus). Read-only, no inline-edit handle.",
        "**Zone heatmap** — keep. It's the most narrative chart; players want to see where their bowls landed.",
        "**Skip:** hand balance + length distribution. Too analytical for the player surface; it lives in the admin view for the coach.",
      ].join(" "),
      impl: [
        "New route `app/(player)/t20/[assessmentId]/page.tsx`.",
        "Reuse `<GradePill>`, `<CompassHeatmap>` from existing components (extract from `t20-components.jsx` if not yet componentised).",
        "Hero gradient logic lives in `lib/brand/grade.ts` (see theme item).",
        "Mobile-first: hero stacks (grade pill above number); section breakdown becomes `r1 / r2` collapsed into a single `Total · %` column at <600px.",
        "Wire `Request re-assessment` button to `messageRequestAction` (same path the existing `Request assessment` CTA uses on `/t20`).",
      ],
      open: [
        "Confirm: drop hand-balance and length-distribution from player view? (Brief says \"probably skip\".)",
        "Confirm: re-assessment request copy — \"Request re-assessment\" or \"Ask for another go\"?",
      ],
    },
    {
      id: "tournament-edit-page",
      reference: "Phase 12 highlight · Tournament edit page missing",
      surface: "app/(club-admin)/manage/tournaments/[id]/edit/page.tsx (NEW)",
      severity: "high",
      group: "Tournament admin",
      intent: "Edit-mode variant of `/manage/tournaments/new`. Same 5-step wizard skeleton, but pre-filled from the existing tournament and gated where edits would invalidate live state (e.g. format-change after first match scored).",
      visual: [
        "Top eyebrow reads `EDIT TOURNAMENT` instead of `NEW TOURNAMENT`. Wizard step indicator unchanged.",
        "Step 1 (basics) — fully editable always.",
        "Step 2 (format) — locked once any match has a score; show a red-bordered notice card with `This format is locked. Why?` info link.",
        "Step 3 (entrants) — editable; adding entrants is fine, removing prompts a confirm dialog.",
        "Step 4 (rinks) — editable.",
        "Step 5 (publish) — replace with a `Save changes` action; keep the `Discard` ghost button.",
      ].join(" "),
      impl: [
        "Reuse `page-new.jsx` step components from design source as the implementation reference.",
        "New action `updateTournamentAction(id, patch)` with optimistic-locking on `updated_at`.",
        "Wire `format-locked` predicate from existing `tournamentHasScores(id)` query (already in `lib/tournaments/queries.ts`).",
      ],
      open: [
        "Should the user land on Step 1 by default, or remember the last visited step? Recommend Step 1.",
        "Allow renaming a tournament after publish? (Yes; just a soft-warn that public links update.)",
      ],
    },
    {
      id: "t20-cancel-confirm",
      reference: "Phase 12 highlight · T20 capture wizard — Cancel-with-confirmation",
      surface: "app/(club-admin)/manage/t20/new/page.tsx · Cancel button",
      severity: "med",
      group: "Twenty 20 admin",
      intent: "Tapping Cancel on the capture wizard while at least one shot is recorded prompts a confirmation dialog. With zero shots recorded, Cancel exits silently.",
      visual: [
        "shadcn `<AlertDialog>`. Title: `Discard this assessment?`. Body: `You've recorded N shots across M sections. Discarding can't be undone.`",
        "Primary destructive action: `Discard assessment`. Secondary: `Keep editing`.",
        "Pill at top of body shows current grade-projection (`Projected: SILVER · 64%`) so the coach sees what they'd lose.",
      ].join(" "),
      impl: [
        "Extend `t20-page-capture.jsx` Cancel handler to read shot count from local state.",
        "If `shotsRecorded === 0` → `router.push(\"/manage/t20\")` directly.",
        "Else → open `<AlertDialog>` from `components/ui/alert-dialog.tsx` (add primitive if not present — it ships with shadcn).",
      ],
      open: [],
    },
    {
      id: "t20-list-empty-states",
      reference: "Phase 12 highlight · T20 list page — empty state + URL-driven filter",
      surface: "app/(club-admin)/manage/t20/page.tsx",
      severity: "med",
      group: "Twenty 20 admin",
      intent: [
        "(a) Empty state when the logged-in coach has zero captures — `<EmptyState>` with `Capture your first Twenty 20` primary CTA.",
        "(b) Filter state (rubric, grade, date-range) is reflected in the URL (`?rubric=v2&grade=silver`), survives reload, and is shareable.",
      ].join(" "),
      visual: [
        "Empty state: centred, 320px max-width, mono eyebrow `NO ASSESSMENTS YET`, display headline `Capture your first Twenty 20`, body `Pick a player, run them through the 7 sections, sign off.`, primary CTA → `/manage/t20/new`.",
        "Filter chip row above the list, pill-style, currently-active filters in primary fill, click-X to clear individually, `Clear all` ghost link at end.",
      ].join(" "),
      impl: [
        "Wrap list with `useSearchParams` / `useRouter().replace` to sync filter state ↔ URL.",
        "Use `<EmptyState>` primitive (see Components item) — bring it in as a co-required deliverable.",
      ],
      open: [
        "Should the empty-state apply per-rubric (no captures **of v2** yet) or just total? Recommend: total only at v1.",
      ],
    },
    {
      id: "rubrics-view-schema-modal",
      reference: "Phase 12 highlight · Rubrics page — View schema modal",
      surface: "app/(super-admin)/platform/rubrics/[id]/page.tsx",
      severity: "med",
      group: "Super-admin",
      intent: "Click `View schema` on a rubric row → modal showing the rubric's section structure (7 sections, model per section, max points per round, total).",
      visual: [
        "shadcn `<Dialog>`, max-width 720, scrollable body.",
        "Header: rubric `name + version` + close.",
        "Body: table with columns `# / Section / Model / Max R1 / Max R2 / Total`. Footer row: `Grand total / max`.",
        "Below table: a thin `JSON` button → reveals raw `rubric.schema` JSON for super-admin power users.",
      ].join(" "),
      impl: [
        "New `RubricSchemaDialog` component, fed from `rubricById(id).schema`.",
        "Reuse `tbl` table styles (admin t20 results view ships them).",
        "JSON reveal: `<details><summary>JSON</summary><pre>…</pre></details>` — no need for a copy-to-clipboard primitive at v1.",
      ],
      open: [],
    },

    /* --- New audit findings (added by this pass) --- */
    {
      id: "stub-page-phase-tag",
      reference: "NEW · `<StubPage>` exposes `phase=\"Phase 5\"` in production chrome",
      surface: "components/layout/StubPage.tsx",
      severity: "high",
      group: "Cross-cutting",
      intent: "Dev-time scaffolding tag should not render in stakeholder-facing routes. Either gate by `NODE_ENV !== \"production\"` or replace with a real empty state.",
      visual: "Replace with `<EmptyState>` once the primitive ships. Until then: hide the phase tag in production builds.",
      impl: [
        "Wrap the phase pill in `process.env.NODE_ENV !== \"production\" && (...)`.",
        "Long-term: every route currently using `StubPage` (`/play`, `/me`, `/me/inbox`, `/manage/messages`, etc.) gets a real implementation or a real EmptyState.",
      ],
      open: [],
    },
    {
      id: "tabs-fork",
      reference: "NEW · Player tab-bar diverges from shadcn Tabs",
      surface: "player-styles.css :: .tab-bar / .tab-btn vs components/ui/tabs.tsx",
      severity: "high",
      group: "Components",
      intent: "Single tab primitive consumed by both surfaces. Mobile skin differs only in size + bottom-line treatment, not in JSX.",
      visual: "Wrap shadcn `<Tabs>` in `<MobileTabBar>` that re-skins the trigger row to the player visual (60px tall, 12px label, primary underline). Same accessibility (`role=tablist`).",
      impl: [
        "Create `components/layout/MobileTabBar.tsx` re-exporting shadcn Tabs with custom `TabsList` / `TabsTrigger` className overrides.",
        "Migrate `PageInbox` (player) to use `MobileTabBar`.",
        "Delete `.tab-bar` / `.tab-btn` rules from `player-styles.css`.",
      ],
      open: [],
    },
    {
      id: "empty-state-primitive",
      reference: "NEW · Missing shared `<EmptyState>` primitive",
      surface: "components/layout/EmptyState.tsx (NEW)",
      severity: "high",
      group: "Components",
      intent: "One component covers: rubrics empty, t20 list empty, messages Sent empty, future tournaments empty, members empty, etc.",
      visual: [
        "Centred column. Optional 56px lucide icon (ink-muted). Eyebrow (mono uppercase 11px). Display headline (24px). Body copy (15px ink-muted, max 320px). Optional primary CTA. Optional secondary ghost.",
        "On bone background by default; pass `variant=\"on-surface\"` for surface-tinted contexts.",
      ].join(" "),
      impl: [
        "Type: `{ icon?: LucideIcon; eyebrow?: string; title: string; body?: string; primaryCta?: {label: string; href?: string; onClick?: () => void}; secondaryCta?: ... }`.",
        "Replace `StubPage` body with this once stubs become real routes.",
      ],
      open: [],
    },
    {
      id: "loading-spinner-only",
      reference: "NEW · loading.tsx files render unstyled spinners",
      surface: "app/**/loading.tsx",
      severity: "med",
      group: "Cross-cutting",
      intent: "Each route's `loading.tsx` renders a Skeleton tree shaped like that route, not a generic spinner.",
      visual: "Match the route's grid: list pages get `<Skeleton>` row repeats; detail pages get hero block + section blocks; admin t20 results gets hero-shaped block + table-shaped block + 3 chart-shaped blocks.",
      impl: [
        "Audit `app/**/loading.tsx`. For each, replace its body with a Skeleton tree mirroring the corresponding `page.tsx`.",
        "If a route has no meaningful structure to mimic, it shouldn't have a `loading.tsx`.",
      ],
      open: [],
    },
    {
      id: "grade-color-extraction",
      reference: "NEW · Grade colours hex-coded inline in admin t20 hero",
      surface: "t20-page-results.jsx · heroBg",
      severity: "med",
      group: "Theme",
      intent: "Single source for grade tier colours; consumed by hero gradient + GradePill + any future surface that surfaces a grade.",
      visual: "No visual change.",
      impl: [
        "Create `components/brand/grade.ts` exporting `GRADE_COLORS = { gold: { from, mid, to, ink }, silver: {…}, bronze: {…}, retry: {…}, ungraded: {…} }`.",
        "`GradePill`, hero gradient, and any future surface read from this constant.",
      ],
      open: [
        "Should `silver` derive from theme `--primary-300/500/700` (current behaviour) or be a fixed silver gradient like gold/bronze? Recommend: fixed, so silver looks the same across every preset.",
      ],
    },
    {
      id: "icon-stroke-scale",
      reference: "NEW · Icon stroke + size discipline drift",
      surface: "Cross-cutting (lucide consumers)",
      severity: "low",
      group: "Iconography",
      intent: "Stroke 2 default; 2.5 only on aria-current. Sizes from a 4-step scale (14 / 16 / 20 / 24).",
      visual: "No visible change at most consumers; landing's bespoke `IconArrow` (stroke 2.2) becomes 2.",
      impl: [
        "Add ESLint rule (or simple grep guard) flagging size literals outside the scale.",
        "Replace bespoke `IconArrow` / `IconTournament` / `IconScore` / `IconCompass` in `landing.jsx` with lucide `ArrowRight` / `Trophy` / `Target` / `Compass`.",
      ],
      open: [
        "Keep the bespoke landing icons as a brand differentiator? If yes, formally exempt them in the system spec.",
      ],
    },
    {
      id: "responsive-admin-t20-charts",
      reference: "NEW · Admin t20 results charts collapse painfully <900px",
      surface: "t20-page-results.jsx · charts grid",
      severity: "med",
      group: "Responsive",
      intent: "Charts grid stacks single-column on narrow viewports; full-width per chart.",
      visual: "Heatmap stays square; hand-balance and length-distribution become full-width landscape cards on mobile.",
      impl: [
        "Replace `gridTemplateColumns:\"1.2fr 1fr 1fr\"` with `<div className=\"grid grid-cols-1 gap-[18px] md:grid-cols-[1.2fr_1fr_1fr]\">…`.",
        "Consider hiding the 256-deliveries `muted text-xs` caption < 480px to save vertical space.",
      ],
      open: [],
    },
    {
      id: "player-bottom-padding",
      reference: "NEW · Player content scroll containers don't reserve bottom-nav space",
      surface: "Cross-cutting (`mcontent` + `(player)/layout.tsx`)",
      severity: "med",
      group: "Responsive",
      intent: "All player content respects `bottom-nav-height + safe-area-inset-bottom` so list bottoms aren't clipped.",
      visual: "Nothing visual changes when content is short. Long lists gain breathing room.",
      impl: [
        "Add `pb-[calc(env(safe-area-inset-bottom)+80px)]` to the `(player)/layout.tsx` main scroll container.",
        "Remove ad-hoc `padding-bottom` declarations from `player-styles.css :: .mcontent`.",
      ],
      open: [],
    },
    {
      id: "speckle-intensity-step",
      reference: "NEW · Three undocumented speckle intensity steps in use",
      surface: "Cross-cutting (`SpeckleField` consumers)",
      severity: "low",
      group: "Brand surfaces",
      intent: "Three named intensities: `subtle` / `medium` / `bold`. Every consumer picks one.",
      visual: "No change at the canonical sites; auth aside (currently default 1.0/1.0) reclassified as `subtle`.",
      impl: [
        "Add `intensity?: \"subtle\" | \"medium\" | \"bold\"` prop on `SpeckleField` that maps to `(density, opacityScale)` pairs.",
        "Migrate inline numeric props at all consumers.",
      ],
      open: [],
    },
  ],
};
