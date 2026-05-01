# Phase 12.5 — Design fidelity & unification triage

**Branch:** `rebuild/phase-12.5-design-unification` · **Cut from:** `555ea83` (Phase 12 close) · **Audit produced:** 2026-05-01 (Claude Design session, chat6)

The Phase 12.5 audit lives in [`docs/audit/phase-12.5/`](./docs/audit/phase-12.5/) — `audit-data.js` is the machine-readable source of truth (system findings + 22 per-entry briefs); the sibling HTML is the rendered viewer.

This file maps each audit entry to a Phase 12.5 sub-checkpoint and records the locked user decisions taken at audit close.

## Locked user decisions (no re-asks)

1. **`player-t20-results-detail`** — DROP hand-balance and length-distribution charts; player view is motivation-not-analysis. Re-assessment CTA copy: `"Request re-assessment"` (mirrors `"Request assessment"` from 12-1).
2. **`grade-color-extraction`** — Silver gets a FIXED gradient like gold and bronze. Not derived from theme primary tokens; same across every preset.
3. **Already-closed-in-12-6 entries — REJECT the audit's revisit recommendations:**
   - `topnav-pill-vs-text` — closed DROP at 12-6. Shipped text-link nav stays. No change.
   - `hero-headline-decide` — closed DROP at 12-6. Shipped variant A (`EIGHT ZONES. ONE JACK. PROOF YOU'RE IMPROVING.`) stays. No change.
   - `speckle-pocket-hex-drift` — closed no-op at 12-6. No change.
4. **`icon-stroke-scale`** — KEEP custom `IconArrow` / `IconTournament` / `IconScore` / `IconCompass` in `landing.jsx` as a brand differentiator. Lucide everywhere else; landing is formally exempt in the system spec.
5. **`tournament-edit-page`** — Land on Step 1 by default. Allow renaming after publish with soft-warn that public links update.
6. **`t20-list-empty-states`** — Total-only empty state at v1 (not per-rubric).
7. **`speckle-seed`** — `seedKey` required for non-fluid renders; document in the type.

## Sub-checkpoint mapping

### 12.5-prep — branch + audit + DRIFT sweep + triage doc (this commit)

Branch cut, audit package staged under `docs/audit/phase-12.5/`, DRIFT_LOG sweep aligning open entries to specific 12.5-N sub-checkpoint owners, this triage doc committed.

### 12.5-1 — foundation primitives

System dimensions: `type`, `spacing`, `primitives` (Tabs unification + EmptyState ship).

| audit id | source |
|---|---|
| `tabs-fork` | NEW · player tab-bar diverges from shadcn Tabs → `MobileTabBar` wrapper |
| `empty-state-primitive` | NEW · ship `<EmptyState>` (foundation for 12.5-3 + 12.5-2) |
| `type` system dimension | typography roles + 4-step body scale (13/15/17/20) + canonical `eyebrow` |
| `spacing` system dimension | container padding scale + radius scale (delete 12; keep 10/14/20/24) + form-control heights (40 default / 44 primary / 48 mobile-block) |
| `primitives` system dimension | arbitrary-variant audit (forbid `peer-` selectors in `components/ui/`) |

### 12.5-2 — theme + speckle + StubPage rewrite

System dimensions: `theme`, `speckle`. Depends on `<EmptyState>` from 12.5-1.

| audit id | source |
|---|---|
| `grade-color-extraction` | NEW · `lib/brand/grade.ts` exporting `GRADE_COLORS` (silver fixed) |
| `speckle-seed` | DRIFT L39 · `seedKey` prop on `SpeckleField` |
| `speckle-intensity-step` | NEW · `intensity` prop with `subtle / medium / bold` mapping |
| `stub-page-phase-tag` | NEW · 12-7 already dropped `phase` prop; rewrite body to use `<EmptyState>` |

### 12.5-3 — T20 admin polish

| audit id | source |
|---|---|
| `t20-cancel-confirm` | DRIFT L161 · capture wizard Cancel-with-confirmation `<AlertDialog>` |
| `t20-list-empty-states` | DRIFT L156 + L157 · coach-no-captures empty state + URL-driven filter chips (consolidates two separate DRIFT entries) |
| `rubrics-view-schema-modal` | DRIFT L172 · `RubricSchemaDialog` |

### 12.5-4 — NEW build · Player T20 results detail view

| audit id | source |
|---|---|
| `player-t20-results-detail` | DRIFT L127 · `app/(player)/(gated)/t20/[assessmentId]/page.tsx` route. Hero + section breakdown + categorised notes tiles (read-only) + heatmap. Charts dropped per locked decision. `Request re-assessment` CTA. |

### 12.5-5 — NEW build · Tournament edit page

| audit id | source |
|---|---|
| `tournament-edit-page` | DRIFT L131 · `app/(club-admin)/manage/tournaments/[id]/edit/page.tsx`. 5-step wizard pre-filled from existing tournament; format-step locked once any match has a score; `updateTournament` action with optimistic-locking on `updated_at`. |

### 12.5-6 — responsive + cross-cutting

System dimensions: `responsive`, `icons`, `empty` (loading.tsx).

| audit id | source |
|---|---|
| `responsive-admin-t20-charts` | NEW · admin t20 results charts grid → `md:grid-cols-3` / `grid-cols-1` <900px |
| `player-bottom-padding` | NEW · `pb-[calc(env(safe-area-inset-bottom)+80px)]` on `(player)/layout.tsx` main scroll container |
| `loading-spinner-only` | NEW · `app/**/loading.tsx` audit; replace spinners with route-shaped Skeleton trees |
| `icon-stroke-scale` | NEW · stroke 2 default / 2.5 only on aria-current; 4-step icon-size scale (14/16/20/24); landing icons formally exempt |

### 12.5-7 — pre-stakeholder QA + Phase 12.5 close

Block A walkthrough across all surfaces (matches Phase 12 / 12-7 pattern). Block B + C: any cross-cutting fixes from QA + plan reconciliation if needed + PHASE_LOG / README close.

## Closed-at-prep entries (already shipped or rejected)

These audit entries appear in `audit-data.js` but require no Phase 12.5 work:

| audit id | resolution |
|---|---|
| `compass-wedge-labels` | Closed Phase 12 / 12-6 (`92543b6`) |
| `compass-legend-wording` | Closed Phase 12 / 12-6 (`92543b6`) |
| `compass-metadata-drift` | Closed Phase 12 / 12-6 (`92543b6`) |
| `auth-checkbox-arbitrary` | Closed Phase 12 / 12-6 (`3e4720f`) |
| `topnav-pill-vs-text` | Closed Phase 12 / 12-6 (DROP per locked decision) |
| `hero-headline-decide` | Closed Phase 12 / 12-6 (DROP per locked decision) |
| `speckle-pocket-hex-drift` | Closed Phase 12 / 12-6 (no-op audit; already at parity) |

The `copy` system dimension is also closed-at-prep — its drift items are the three compass entries above (all shipped) plus the hero headline (DROP) and the locked-exception player-nav `Tourneys`/`20/20` strings (Decisions section, no work).

## Out-of-scope for Phase 12.5 (post-v1)

These entries exist in DRIFT_LOG but are explicitly post-v1 and don't get pulled into this phase:

- Personal theme override (member-level override of club preset)
- Super-admin notifications bell
- Scheduled-send dispatcher (messaging Send later)
- Admin general booking creation form is t20_assessment-only
- /me settings deep-links not wired
- CommsTab tournament-scoped Send disabled
- Round-robin / sectional standings tables
- Super-admin /platform/tournaments view
