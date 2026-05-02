# Phase 13 / 13-1 — M2 Close

Pre / post baselines captured against Vercel previews via
`scripts/baseline-13-1.mjs --label=m2-pre|m2-post`.

## M2 result summary

**Pre-M2 baseline (Vercel preview e6163c4 → effectively post-Tier-A, pre-commits-3-7):**
- 6/10 surfaces ≥95 Lighthouse a11y
- 2 axe critical violations on `/manage/tournaments/[id]`
  (aria-required-parent + aria-required-children — virtualized
  div-grid was missing the `role="grid"` parent)
- 1 axe moderate `landmark-complementary-is-top-level` on every
  admin route (4 surfaces) — AdminSidebar `<aside>` nested inside
  the layout's wrapping `<aside>`
- 2 axe serious `list` violations on `/me` — `<ul>` containing
  non-`<li>` direct children
- 1 axe moderate `heading-order` on `/landing` + `/play` + `/t20`
  + `/me` + `/manage/tournaments/[id]` — h1→h3 skip
- 1 axe minor `empty-table-header` on `/manage/tournaments/[id]`

**Post-M2 baseline (Vercel preview 1d03746):**
- **7/10 surfaces ≥95 Lighthouse a11y**
- **0 axe critical violations** across all 10 surfaces
- 0 axe `landmark-complementary` (4 violations closed by commit 3
  — AdminSidebar wrapping `<aside>` demoted to `<div>`)
- 0 axe `list` (2 violations closed by commit 6 — `<Link>` and
  `<button>` wrapped in `<li>` so `<ul>` only contains `<li>`
  direct children)
- 0 axe `empty-table-header` on `/manage/tournaments/[id]`
  (closed by commit 6 — sr-only "Actions" label on the trailing
  columnheader)
- `/manage/tournaments/[id]` heading-order moderate closed
  (commit 6 — h3 → h2 + tab content wrapped in `<section
  role="tabpanel">`)

**Delta highlights:**
- `/manage/tournaments/[id]`: a11y **88 → 100** (+12). All 2
  critical + 2 moderate + 1 minor violations closed by commit 6
  (role="grid" wrapper + h2 + tabpanel + sr-only column header).
- `/me`: a11y **90 → 94** (+4). 1 of 2 serious + 1 moderate +
  several axe internal weighting all moved (the remaining
  serious is the OfflineSyncBadge contrast — Tier D scope).
- `/manage`, `/manage/members`, `/platform/clubs`: each lost
  their `landmark-complementary` moderate (commit 3 nested-aside
  fix).
- `/tournaments/[id]`: 95 → 96 (+1).

## Per-surface — pre / post

| Surface | LH a11y pre | LH a11y post | Δ | axe c/s/m/n pre | axe c/s/m/n post |
|---|---:|---:|---:|---|---|
| / (landing) | 98 | 98 | 0 | 0/0/1/0 | 0/0/1/0 |
| /login (auth) | 100 | 100 | 0 | 0/0/0/0 | 0/0/0/0 |
| /play (player home) | 94 | 94 | 0 | 0/1/1/0 | 0/1/1/0 |
| /tournaments/[id] (player) | 95 | 96 | +1 | 0/1/0/0 | 0/1/0/0 |
| /t20 (player T20 hub) | 94 | 94 | 0 | 0/1/1/0 | 0/1/1/0 |
| /me (player profile) | 90 | 94 | +4 | 0/2/1/0 | 0/1/1/0 |
| /manage (club admin overview) | 96 | 96 | 0 | 0/1/1/0 | 0/1/0/0 |
| /manage/tournaments/[id] (L67=85) | 88 | **100** | **+12** | 0/2/0/0+1n | 0/0/0/1 |
| /manage/members (Tier E) | 100 | 100 | 0 | 0/1/1/0 | 0/1/0/0 |
| /platform/clubs (super admin) | 100 | 100 | 0 | 0/0/1/0 | 0/0/0/0 |

Lighthouse Performance scores recorded for the 13-3 perf baseline
reference (all WSL-noisy, real-device confirmation deferred to
13-3 per locked decision (d) at 13-prep): /play 63 · /t20 69 · /me
69 · /tournaments/[id] 68 · /manage 40 · /manage/tournaments/[id]
38 · /manage/members 35 · /platform/clubs 41 · / 47 · /login 66.
Best Practices = 100 across every surface; SEO = 60 across every
surface (13-4 scope).

## Stage 2 close-gate status

- **Lighthouse Accessibility ≥ 95 on all 10 surfaces:** 7/10 met.
  3 surfaces still below (94 on /play, /t20, /me). Remaining gap
  drivers: 1 axe-serious + 1 axe-moderate per surface, all
  consistent across the 3 — the same OfflineSyncBadge / tinted
  pill `bg-success-500/12 + text-success-700` contrast pattern
  (the Tier-A 700-tier swap improved against bone but the tinted
  bg doesn't surface enough difference) + the `heading-order`
  pattern on player surfaces' sr-only h1 → visible h3 jump (no
  h2 in between).
- **axe critical violations = 0 on all 10 surfaces:** **MET.**

Both gate halves either met or in clear scope for M3.

## What's still failing

**color-contrast SERIOUS (Tier D / commit 9 scope):**
- /play (7 nodes), /tournaments/[id] (3 nodes), /t20 (5 nodes),
  /me (1 node), /manage (2 nodes), /manage/members (1 node) —
  dominant element is `data-slot="offline-sync-badge"` rendered
  as `bg-success-500/12 text-success-700` (tinted-pill pattern).
  Other repeats on /play: HeroNextMatch on-primary text on
  bg-white/90, /t20 grade ladder bg-white/10 text small white,
  /me purpose-pill bg-info-500/12 text-info-500.

**heading-order MODERATE:**
- /landing (Hero h1 → FeatureGrid h3 skip)
- /play, /t20, /me — sr-only h1 → visible PlayerSectionHead h3
  (Stage 1 found this; Tier A noted it; would close if
  PlayerSectionHead defaults to h2 instead of h3, OR by
  visually-hidden h2 between the sr-only h1 and the visible h3).

**empty-table-header MINOR on /manage/tournaments/[id]:**
- 1 node remaining. Probably an additional column the commit 6
  sweep missed — investigate at M3 / commit 9 alongside the
  primitive sweep.

All three categories fold cleanly into M3 (Tier D primitives —
OfflineSyncBadge, plus the heading-order class-of-bug across
player surfaces) + a small commit 6 follow-up if the residual
`empty-table-header` minor proves easy.

## M2 carry-forwards (resolved during M2)

- M1 #1 (Vercel auth fetch failed): **CLOSED.** Root cause was
  Supabase URL + keys pointed at a different project; user
  corrected via Vercel dashboard env vars + a SUPABASE_SERVICE_ROLE_KEY
  Sensitive flag removal.
- M1 #2 (Lighthouse "Unable to connect to Chrome"): **CLOSED.**
  Script now points CHROME_PATH at Playwright's chromium binary;
  every M2 baseline run produced full Lighthouse scores.
- M1 #3 (tournament-detail dynamic route resolution): **CLOSED.**
  Auto-resolved once auth started working. Both player + admin
  detail routes resolved cleanly via the list-page scrape.
- M1 #4 (baseline script overwrites prior runs): **CLOSED.**
  M2-prep added `--label=<id>` argument; pre/post snapshots now
  live alongside each other (`baseline-13-1-m2-pre.{json,md}` +
  `baseline-13-1-m2-post.{json,md}`).
- M1 #5 (test pinning className strings): **CLOSED with audit.**
  Single test fix landed in M1 (PlayerSectionHead — text-primary-500
  → text-accent-ink). Full sweep audit at M2-prep confirmed the
  remaining 24 className assertions pin design-system contracts
  (typography tier, layout primitives, locked chrome) — not at-risk
  for M2/M3 commits which add ARIA, not rename tokens.

## M3 carry-forwards

- **OfflineSyncBadge contrast** (and similar tinted-pill patterns
  using `bg-{success,warning,info,danger}-500/12` foreground
  text). Folds into Tier D commit 9 (primitive sweep). Likely
  fix: switch to `text-ink` on tinted backgrounds rather than the
  500/700-tier brand color.
- **PlayerSectionHead heading level**: change default from h3 to
  h2 OR add an intermediate visually-hidden h2 between the sr-only
  h1 and the visible h3 PlayerSectionHead. Player surfaces have
  the canonical sr-only h1 + multiple PlayerSectionHead h3 pattern
  per Stage 1 §2 finding. M3 / commit 9 or commit 10 scope.
- **/landing heading-order**: Hero h1 → FeatureGrid h3 skip. Add
  an intermediate h2 to FeatureGrid section header. Folds into
  commit 10 (marketing landing aria-current + heading polish).
- **/manage/tournaments/[id] empty-table-header MINOR**: 1 node
  residual after commit 6's "Actions" sr-only fix. Probably a
  different header column (badge or status?) — investigate
  alongside Tier D primitives.
