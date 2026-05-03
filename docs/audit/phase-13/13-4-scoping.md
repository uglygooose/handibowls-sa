# Phase 13 / 13-4 — Scoping

**Branch tip:** `123c370` (`rebuild/phase-13-launch-prep`).
**Read-only audit.** No code changes. Single audit commit at end carrying this report.
**Scope:** SEO + landing brand story + favicon + theme-color + sitemap + robots + queued `play-tournament-cards-revamp` DRIFT entry from 13-3 close.

---

## Reference inputs surveyed

- `app/layout.tsx`, `app/page.tsx`
- `app/(marketing)/_sections/{Hero,FeatureGrid,SocialProof,ShowcaseTournament,ShowcaseT20,Quote,CTABand,LandingTopBar,Footer}.tsx`
- `app/(player)/(gated)/play/{page.tsx,_components/{HeroNextMatch,QuickActions,RecentResults}.tsx}`
- `public/{manifest.webmanifest,icons/*}`
- `app/apple-icon.png`
- HANDIBOWLS_REBUILD_PLAN.md §16 step 4
- DRIFT_LOG.md `play-tournament-cards-revamp`
- Design bundle from `https://api.anthropic.com/v1/design/h/b7NbHVeoHYLsr6dK2tZEZg` — extracted to `/tmp/design-bundle/handibowls/`. **Logo + favicon spec at `project/HandiBowls Logo.html`** (672 lines, comprehensive). Bundle also contains 8 chat transcripts + brand.jsx + landing.jsx + a Showcase.html — **the React+SVG mark is already locked, only export pipeline + install snippet are the build work.**

---

## Item 1 — Landing truthfulness audit

### Current claims (with file:line refs)

| Claim | File:line | Reality | Verdict |
|---|---|---|---|
| "20+ clubs · Live in WP & Northerns" (Hero stat) | Hero.tsx:149-153 | Demo Bowls Club is the only seeded club | **fiction** |
| "Run a knockout, score a Twenty 20, post a ladder, DM the skip" (Hero copy) | Hero.tsx:132 | "post a ladder" + "DM the skip" don't ship in v1 (per DRIFT-`ladder-league` + DRIFT-`dm-the-skip-player-to-player`) | **partial fiction** |
| Hero MARQUEE: "Round robins / Ladder league / Drawn pairs" | Hero.tsx:74,80,81 | Round-robin engine is a 1.4KB stub, ladder has zero code/schema, drawn-pairs has no distinct UI (per Phase 14 backlog reconciliation 2026-05-02) | **3 fictional formats** |
| FeatureGrid Tournaments body: "Knockouts, round robins, pairs, triples, fours" | FeatureGrid.tsx:24 | round-robin doesn't ship | **partial fiction** |
| FeatureGrid Tournaments body: "auto-seeding" | FeatureGrid.tsx:24 | auto-seeding ships (Phase 6a `lib/tournaments/seeding.ts`) | truthful |
| FeatureGrid Tournaments body: "score capture that survives a dropped Wi-Fi" | FeatureGrid.tsx:24 | Dexie outbox + Serwist SW (now actually registered post-Batch I) | truthful |
| FeatureGrid Twenty 20 body: "Eight-zone compass, graded jacks, rubrics locked by district" | FeatureGrid.tsx:42 | Compass + grading + rubrics ship; "rubrics locked by district" overstates — rubric is global v1 (district-specific rubric versioning is post-v1) | **partial fiction** |
| SocialProof headline: "Backed by clubs from Cape Town to Pretoria" | SocialProof.tsx:43-44 | not deployed at any clubs yet | **fiction** |
| SocialProof body: "HandiBowls started with the Western Province pilot and now runs knockouts, Twenty 20 cards, and ladder leagues at 20+ clubs across five districts" | SocialProof.tsx:46-50 | no WP pilot, no clubs, no ladder leagues | **wholly fictional** |
| SocialProof STATS: "20 Clubs in pilot · 5 Districts onboard · 4 Formats supported · ∞ Ends per match" | SocialProof.tsx:3-8 | clubs + districts numbers fictional; "4 Formats" is undercount (5 ship: singles/pairs/triples/fours/mixed_pairs); "∞ ends" is meaningless | **wholly fictional** |
| Quote testimonial: "Nthabi Mokoena · Club Captain · Rondebosch BC" | Quote.tsx:14-26 | fabricated person + fabricated club | **fiction** |
| ShowcaseTournament feature list: "Knockout, round robin, double-elim" + "Auto-seeding from handicap or ladder" | ShowcaseTournament.tsx:132-133 | round-robin doesn't ship; double-elim doesn't ship; ladder doesn't ship; "from handicap" is misleading (BSA-scoped events default to scratch) | **partial fiction** |
| ShowcaseTournament header: "Northerns Open 2026" | ShowcaseTournament.tsx:71 | mockup tournament name on a static design preview, not a real-deployment claim | acceptable as design mockup chrome |
| Footer: "HandiBowls · 2026 · Cape Town" | Footer.tsx:97 | place tag, not an audience claim | truthful |

### Drop / replace recommendations

**Drop entirely (no replacement needed):**
- SocialProof entire section (or wholly rewrite — see below).
- Quote testimonial (or replace with something that's actually accurate, e.g. internal product positioning copy from the founder, framed as a positioning statement rather than a sourced quote — **Decision needed**).

**Drop fictional verbs / formats from copy:**
- Hero copy line `Run a knockout, score a Twenty 20, post a ladder, DM the skip` → **Recommendation:** `Run a knockout, score a match, capture a Twenty 20, message your members.` (every verb maps to a shipping feature: knockout = tournament engine, scoring = scorecard, T20 = assessment module, messaging = comms tab.)
- Hero MARQUEE: drop `Round robins`, `Ladder league`, `Drawn pairs`. Keep: `Knockouts · Pairs · Triples · Fours · Singles · Twenty 20 · Mixed Pairs`. Add 1-2 new items if the marquee feels short (e.g. `Greenside scoring · Offline-first · BSA-native` — process/value items rather than format claims).
- FeatureGrid Tournaments body: replace `round robins` with `mixed pairs`. Final body text recommendation: `Knockouts, pairs, triples, fours, singles, mixed pairs. Live brackets, auto-seeding, score capture that survives a dropped Wi-Fi.`
- ShowcaseTournament feature list: replace `Knockout, round robin, double-elim` with `Knockout — single-elim, BSA-style draws.` and replace `Auto-seeding from handicap or ladder` with `Auto-seeding from team-sheet or handicap (club-internal).`

**Drop fictional stats:**
- Hero stat block "20+ clubs · Live in WP & Northerns" → **Recommendation:** drop entirely, OR replace with non-quantitative anchors:
  - `Built for BSA — 20 districts mapped, 5 disciplines.`
  - `Offline first — Greenside capture.`
  
  Both are truthful; the first replaces the marketing-flavoured "20+ clubs" with a substantive feature claim.
- SocialProof STATS array → **Decision needed** (see below).

**Reframe Twenty 20 (Item 2):**
- Currently the marquee lumps `Twenty 20` alongside format names like `Knockouts / Pairs / Triples / Fours / Singles`. This positions T20 as a tournament format. **It isn't.** T20 is a unique-to-HandiBowls **skill-assessment offering** — 8-zone compass, weighted scoring, graded outcomes, separate from any tournament format.
- **Recommendation:** Pull `Twenty 20` out of the format marquee. Either (a) drop a horizontal divider and run a second mini-marquee labeled "Skills" with `Twenty 20`, or (b) lean on FeatureGrid's existing `03 — Improve · Twenty 20 skills` card to do this work and just remove `Twenty 20` from the marquee. **Option (b)** is simpler.

### Decisions needed (Item 1)

- [ ] **D1.1** Approve drop list (or strike specific items).
- [ ] **D1.2** Approve replacement copy on Hero / FeatureGrid / ShowcaseTournament.
- [ ] **D1.3** SocialProof section disposition — three options:
  - **(a) Delete the section entirely.** Landing flows Hero → FeatureGrid → ShowcaseTournament → ShowcaseT20 → Quote → CTABand. Removes a whole "social proof" surface that isn't socially proven.
  - **(b) Repurpose to "Built for BSA" credibility band.** Replace stats with substantive product claims: "20 districts mapped · 5 disciplines · BSA terminology native · POPIA compliant". Anchor on factual product attributes.
  - **(c) Keep as ambition framing.** Reword from past-tense ("started with WP pilot... now runs at 20+ clubs") to present-tense vision ("Built for the bowls community across South Africa's 20 BSA districts."). Risk: still reads as soft puffery.
- [ ] **D1.4** Quote testimonial disposition — three options:
  - **(a) Delete entirely.** Strongest truthfulness win.
  - **(b) Replace with founder-positioning statement.** Rewrite as a first-person product manifesto, no fake attribution. Same visual treatment, different intent.
  - **(c) Park empty until real customers ship.** Comment-out the section import; uncomment when first club deploys.
- [ ] **D1.5** Twenty 20 reframe approach — Option (a) separate mini-marquee or (b) drop from marquee, lean on FeatureGrid card?
- [ ] **D1.6** "rubrics locked by district" claim disposition — drop the qualifier, or rephrase to "rubric versioning ready for district-specific schemas (v1 ships a single global rubric)" — second is more accurate but verbose.

---

## Item 2 — Twenty 20 reframing

(Decision rolled into D1.5 above. Code change scope: `Hero.tsx:79` MARQUEE_ITEMS array — 1 line removed; FeatureGrid card already correctly frames T20 as the skills-assessment offering, no change needed there.)

---

## Item 3 — Mobile landing layout fix

### Cause analysis (from code-read)

`app/(marketing)/_sections/Hero.tsx:108,167-189`:

- The Hero is a 2-column grid: `<div class="grid max-w-[1440px] gap-10 px-5 py-12 md:grid-cols-[1.1fr_1fr] md:gap-10 md:px-12 md:pt-20 md:pb-14">`. Below `md:` (<768px) the grid collapses to a single column.
- The art column at line 167 has fixed `min-h-[340px]` on mobile (`md:min-h-[540px]` on desktop).
- Inside the art column live three absolutely-positioned `<Bowl>` instances + two `<Sticker>` cards:
  - Main bowl (line 170-175): `top-[-20px] right-[-80px]` with `size={620}`. **620px is nearly 2× the 340px container height**, with -80px right offset pushing the bulk of the bowl off-screen. On a 375px viewport, what's visible is the bottom-left quadrant of a 620px disc.
  - Ghost bowl (line 177-182): `left-[-30px] bottom-5` with `size={200}`.
  - Tiny bowl (line 184-189): `right-[70px] bottom-[-20px]` with `size={110}`.
- The 340px container is dominated by the partial main bowl + the two smaller bowls, but the main bowl's negative-top + size = it occupies ~480px of vertical span starting at -20px, which means **~140px of the bowl extends below the container's bottom edge**. The visible bowl ends ~330px of vertical paint, but the container has been allocated 340px height regardless.
- The "empty whitespace problem" likely manifests as: at viewport widths where the bowls render at full intended size, the art column reserves 340px on mobile but the bowls occupy only ~280px of meaningful visual content (the rest is overflow-hidden whitespace where the off-screen-right portion of the main bowl SHOULD be).

**Root cause:** the art column was sized for desktop (md:min-h-[540px], where 540px accommodates the 620px main bowl with margin) and the mobile fallback (340px) was set without re-tuning the bowl sizing or positioning.

### Fix shape options

- **(A) Shrink the main bowl on mobile.** Pass a smaller `size` prop on mobile via `clamp()` or a Tailwind responsive variant. Tailwind doesn't support responsive props on a numeric `size` directly, so this needs CSS — likely a CSS variable controlling the bowl's effective rendered size, with a mobile media query. Bigger code change.
- **(B) Shrink the art column min-h on mobile + tighten bowl positioning.** Drop `min-h-[340px]` to `min-h-[260px]`, change main bowl `top-[-20px] right-[-80px]` to `top-[-10px] right-[-30px]` on mobile (so less of the bowl is clipped). Smallest code change. Visual signal: the main bowl is more centered and visible, less negative space.
- **(C) Stack vertically with bowls below copy on mobile, restructured spacing.** The grid-collapse already does this; the issue is the absolute-positioned bowls don't reflow. Switch the bowl layout from absolute-within-art-column to a constrained flex/grid that the bowls participate in normally on mobile. Biggest design change but cleanest result.

### Decisions needed (Item 3)

- [ ] **D3.1** Pick fix shape — A (CSS-driven sizing), B (min-h + position tighten), or C (restructured layout).
- [ ] **D3.2** Lock target breakpoints — current code only has one mobile/desktop split at `md:` (768px). Smaller breakpoints (`sm:` 640px) or smaller (≤375px iPhone SE) get whatever the mobile branch provides. Confirm this is acceptable, or open a new viewport tier.
- [ ] **D3.3** Operator-side runtime confirmation needed at execution batch — the cause analysis is from code-read, not a real device. Re-test on 375 / 390 / 412 viewports after fix lands.

---

## Item 4 — /play tournament cards revamp

### Current state (from `_components/HeroNextMatch.tsx` + `RecentResults.tsx` + `QuickActions.tsx`)

**HeroNextMatch.tsx (the iconic card on /play):**
- Background: `bg-primary-500` at line 79 — **theme-token-driven** (resolves to active theme's primary). Already follows club preset for the bg.
- SpeckleField (line 90-95): `preset={match.tournament.host_club_theme}` — passed from data layer.
- SplatterAccent (line 97-104): `preset={match.tournament.host_club_theme}` — passed from data layer.

**RecentResults.tsx:**
- Background: `bg-surface` (theme-invariant, page bg)
- Outcome pills: `bg-success-500/12` / `bg-danger-500/12` / `bg-info-500/12` — functional colors, theme-invariant. Already AA-clear.

**QuickActions.tsx:** (not opened in this scoping; assumed similar pattern.)

### Theme-coupling analysis

The DRIFT entry (`play-tournament-cards-revamp`) reports: *"cards backgrounds should follow club preset (currently render hardcoded against a different surface than rest of app — visible when club preset is non-atomic-red, top nav + chrome update but cards stay red)."*

What's actually happening per the code-read:
- `HeroNextMatch.tsx` uses `bg-primary-500` (active theme's primary, theme-token-driven), AND `match.tournament.host_club_theme` for SpeckleField + SplatterAccent (the SPECIFIC tournament's host club theme, passed from `_data.ts`).
- The user's seed-data club is atomic-red. The seed-data tournament's host_club_theme is also atomic-red. So when the user swaps their personal club preset (theme override), the active theme shifts but the tournament's host_club_theme stays atomic-red.
- Result: the page chrome (sidebar, nav, page bg) follows the active theme; the SpeckleField + SplatterAccent on the tournament card stay atomic-red because the tournament card's accent assets are bound to the tournament's host club theme, not the viewer's active theme.

This isn't a code bug — it's a deliberate design decision (tournament cards reflect the host club's brand) that surfaces visual mismatch when a user views a tournament hosted by a club with a different theme.

### Decision needed — what should /play tournament cards do?

- **(i) Keep host_club_theme on the tournament card chrome.** Visual semantics: "this tournament is run by [host club]; their brand drives the card." Implies seed data needs enrichment so the demo experience surfaces the multi-theme nature. **Out-of-scope for 13-4 (seed-data work is 13-8 stakeholder-QA).**
- **(ii) Switch tournament card chrome to the viewer's active theme.** Visual semantics: "everything you see is in your club's brand." Implies losing the per-host visual variety in tournament listings. Code change scope: HeroNextMatch lines 91 + 99 swap `match.tournament.host_club_theme` for the active theme (already reachable via `useTheme()` or via the `ThemeApplier` context, depending on plumbing).
- **(iii) Hybrid — viewer theme on personal-context surfaces, host theme on tournament-detail surfaces.** /play HeroNextMatch is "your next match" (personal context) → viewer theme. /tournaments/[id] is "this tournament" (host context) → host theme. Most semantically rich; biggest design call.

The DRIFT entry text I authored at 13-3 close presumed (ii). Re-reading the user's original visual-review feedback: "top nav + chrome update but cards stay red". That language implies the user expected the cards to follow the active theme, i.e. **(ii)**. I'll surface all three for explicit lock.

### Visual revamp scope (independent of theme-coupling decision)

DRIFT entry also flagged "small visual revamp for cohesion with rest of app's bone/white-card-with-accent pattern." Reading HeroNextMatch.tsx vs other player surfaces (`/me` cards, `/tournaments` cards): the rest of post-12.5 player chrome is mostly **bone/white card surface + accent strip + token-driven typography**, while HeroNextMatch is a **full primary-500-flooded card with speckle field + splatter accent**. They're intentionally different — HeroNextMatch is "the iconic next-match hero" (per the inline comment at line 86-89: "/play's HeroNextMatch is the iconic top-of-page hero card with a more saturated speckle than any other surface").

**My read:** the visual revamp shouldn't make HeroNextMatch look like the rest of /me; it's intentionally different. The revamp scope is just the theme-coupling fix + maybe a small contrast or chrome polish.

### Decisions needed (Item 4)

- [ ] **D4.1** Theme-coupling fix shape — pick (i), (ii), or (iii) above.
- [ ] **D4.2** Visual revamp scope — narrow ("just the theme fix, leave HeroNextMatch's iconic flooded-primary chrome intact") OR wide ("also restyle to the bone/card pattern"). My recommendation: **narrow**, the iconic hero is intentional.

---

## Item 5 — Favicon + theme-color + manifest icons

### Current state

| Asset | File | Size | Notes |
|---|---|---|---|
| Apple touch icon | `app/apple-icon.png` | 4267 bytes | Next.js conventional file (root-level → auto-emitted as `<link rel="apple-touch-icon">`) |
| PWA 192 | `public/icons/icon-192.png` | (present) | manifest entry, purpose="any" |
| PWA 512 | `public/icons/icon-512.png` | (present) | manifest entry, purpose="any" |
| Maskable 192 | `public/icons/maskable-192.png` | (present) | manifest entry, purpose="maskable" |
| Maskable 512 | `public/icons/maskable-512.png` | (present) | manifest entry, purpose="maskable" |
| Favicon SVG | — | — | **NOT PRESENT** |
| Favicon 16 | — | — | **NOT PRESENT** |
| Favicon 32 | — | — | **NOT PRESENT** |
| Favicon 48 | — | — | **NOT PRESENT** |
| Favicon 64 | — | — | **NOT PRESENT** |
| `app/icon.{png,svg}` | — | — | **NOT PRESENT** (Next.js conventional `<link rel="icon">` auto-emit; `apple-icon.png` exists but plain `icon.*` doesn't) |
| `app/opengraph-image.*` | — | — | **NOT PRESENT** (no per-route OG, no root OG image) |

**Manifest (`public/manifest.webmanifest`):**

```json
{
  "id": "/play",
  "name": "HandiBowls",
  "short_name": "HandiBowls",
  "description": "HandiBowls — tournaments, scores, and skills in your pocket.",
  "start_url": "/play",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FAFAF7",
  "theme_color": "#0A0A0A",
  ...
}
```

`theme_color: "#0A0A0A"` (ink) — matches `app/layout.tsx:47` `viewport.themeColor: "#0A0A0A"`. **Both hardcoded to ink, not Atomic Red as the design spec calls for.**

### Reference design summary (from `/tmp/design-bundle/handibowls/project/HandiBowls Logo.html`)

The bundle ships a **comprehensive, build-ready logo + favicon spec.** Key elements:

- **The mark:** speckled bowls disc with concentric jack-target emblem. Same construction as the existing `<Bowl />` component in `components/brand/`. Min size 22px height.
- **Wordmark:** HANDI (ink) + BOWLS (primary-500), italic Barlow Condensed Black.
- **Favicon sizes specified:** 16, 32, 48, 64, 180 (apple-touch), 512 (PWA).
- **Two favicon variants:**
  - **Simple** for ≤64px — disc + jack target, no speckle (speckle becomes mud at small sizes).
  - **Rich** for 180/512 — keeps a hint of speckle for texture.
- **Theme-color meta:** `#D7261E` (Atomic Red) per the bundle's install snippet at line 285:
  ```html
  <meta name="theme-color" content="#D7261E" />
  ```
- **Install snippet (canonical, from design bundle):**
  ```html
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta name="theme-color" content="#D7261E" />
  ```

### Generation approach options

- **(A) Parametric SVG via Next.js `app/icon.tsx` + `app/apple-icon.tsx` (dynamic OG / icon API).** Single source-of-truth, render at any size, themable. Next.js 16 supports this via `ImageResponse` + the conventional file routes. Cleanest. Some build-time overhead.
- **(B) Static PNG-per-size export from a build script.** Source SVG checked in at `public/favicon.svg`; a build script (`scripts/gen-favicons.mjs`) renders to all sizes via `sharp` or similar. Existing `scripts/gen-pwa-icons.mjs` already exists for the PWA 192/512 maskables — could extend that script.
- **(C) Hand-export from the design bundle's React+SVG mark.** Open the design HTML in a browser, capture each tile, save as PNG, commit. Lowest tooling, most manual.

### Theme-color strategy options

- **(α) Lock to `#D7261E` (Atomic Red) per design spec.** Matches the canonical brand. The address-bar tint stays atomic-red regardless of which preset the user has selected. Simplest.
- **(β) Per-preset theme-color via JS at runtime.** `<ThemeApplier>` could update `<meta name="theme-color">` to match the active preset's primary-500. More dynamic but more moving parts; loses the "canonical brand" anchor.
- **(γ) Keep current `#0A0A0A` (ink).** Most conservative; means address bar is dark/neutral on all themes. Mismatches the design spec.

### Decisions needed (Item 5)

- [ ] **D5.1** Pick favicon generation approach — A / B / C.
- [ ] **D5.2** Pick theme-color strategy — α (Atomic Red, design spec), β (per-preset dynamic), γ (ink, current).
- [ ] **D5.3** Manifest `theme_color` — match the meta-tag decision (α keeps `#D7261E` everywhere; β fixes manifest to a single value since manifest can't be dynamic; γ keeps `#0A0A0A`).
- [ ] **D5.4** Manifest `background_color` — currently `#FAFAF7` (surface), keep or change. Recommendation: keep.

---

## Item 6 — SEO: sitemap + robots + OG

### Current state

| Surface | State |
|---|---|
| `app/sitemap.ts` | **NOT PRESENT** |
| `app/robots.ts` | **NOT PRESENT** |
| `app/opengraph-image.{tsx,png,jpg}` | **NOT PRESENT** |
| Per-route OG meta (`generateMetadata` exporting `openGraph`) | **NOT PRESENT** on any route |
| Root layout `metadata.openGraph` | **NOT PRESENT** in `app/layout.tsx` (the Metadata literal at line 34-44 lists title/description/manifest/applicationName/appleWebApp only — no openGraph or twitter). |
| Root layout `metadata.metadataBase` | **NOT PRESENT** — affects how Next.js resolves OG image URLs. |

### Recommended sitemap routes

Public surface set (auth-gated routes have no SEO value + may leak slugs):

```
/
/login
/signup
```

That's it. Everything else is auth-gated; including them would either return 401/redirect or expose internal slugs. Demo Bowls Club page (`/play`, `/me`, `/manage/...`) requires login; sitemap entries there have no value.

### Recommended robots.ts rules

```ts
{
  rules: [
    { userAgent: "*", allow: ["/"], disallow: ["/manage/", "/platform/", "/play", "/book", "/tournaments/", "/me", "/api/"] }
  ],
  sitemap: "https://app.handibowls.co.za/sitemap.xml",
}
```

Allow the marketing landing; disallow auth-gated routes (no value indexing, plus avoid bot session-creation traffic).

### OG image generation options

- **(A) Single `app/opengraph-image.tsx` at root** — one OG image for `/`. Next.js auto-emits OG meta to layout. Simple. v1-acceptable.
- **(B) Per-route OG images** for /, /login, /signup (and post-launch maybe /tournaments/[id] for shareable tournament URLs). Better for social-sharing surface area but only matters if those routes get shared (auth-gated routes don't).
- **(C) Static OG asset checked into `public/og.png`** — no Next.js dynamic generation; just reference in layout metadata.openGraph.

Recommended: **(A) single root `opengraph-image.tsx`** using `ImageResponse` with the bowl mark + wordmark + tagline. Next.js handles size + emit. ~30 lines of code, single source of truth.

### Decisions needed (Item 6)

- [ ] **D6.1** Approve sitemap route list — `/ + /login + /signup` only, or add others?
- [ ] **D6.2** Approve robots rules — allow / + disallow auth-gated, or different shape?
- [ ] **D6.3** OG image generation approach — (A) root dynamic ImageResponse, (B) per-route, or (C) static asset?
- [ ] **D6.4** OG copy + visual — tagline (`Tournaments, scores, and skills in your pocket — for South African lawn bowls.`?), bg color (atomic-red? bone with red accent?), bowl mark size + position. Will need a quick design lock at execution time.
- [ ] **D6.5** Set `metadataBase` in root layout to `new URL('https://app.handibowls.co.za')` so Next.js resolves OG/manifest URLs absolutely. This is operator-side gated on the domain pointing in 13-7; for 13-4 we can set the URL string and ship with that anchor.

---

## Recommended batch shape

Five execution batches + close. Each batch single atomic commit unless flagged:

- **Batch A — Landing truthfulness rewrite + Twenty 20 reframe.** Marketing _sections only. Hero (drop fictional verbs + marquee items + stat block) + FeatureGrid (drop round robins, tighten T20 body) + ShowcaseTournament (drop fictional formats from feature list) + SocialProof (per D1.3 disposition: delete / rewrite / repurpose) + Quote (per D1.4 disposition). Single commit; ~4-7 files; ~50-80 LOC delta depending on D1.3/D1.4 outcomes.

- **Batch B — Mobile landing layout fix.** Hero.tsx art column min-h + bowl positioning per D3.1. Single commit; 1 file; ~10-15 LOC. Operator-side runtime QA on 375/390/412 viewports.

- **Batch C — /play tournament cards revamp.** HeroNextMatch.tsx theme-coupling per D4.1 (+ visual scope per D4.2). Single commit; 1-3 files; ~5-15 LOC depending on (ii) vs (iii) hybrid.

- **Batch D — Favicon + theme-color + manifest.**
  - D-1: Generate favicon assets per D5.1 (svg + 16/32/48/64/180/512 PNGs). Adds files under `public/` or `app/`. 1 commit.
  - D-2: Update root layout metadata + viewport.themeColor + manifest theme_color per D5.2/D5.3. 2-3 LOC. 1 commit.
  - Combined or split — small enough to combine into one commit if D5.1 picks the static-export path (no new build script complexity).

- **Batch E — SEO surfaces.**
  - E-1: `app/sitemap.ts` + `app/robots.ts` + `metadataBase` on root layout. 1 commit.
  - E-2: `app/opengraph-image.tsx` + `metadata.openGraph` + `metadata.twitter` on root layout. 1 commit.
  - May combine if scope stays under 250 LOC.

- **13-4 close** — PHASE_LOG entry + DRIFT bookkeeping (close `play-tournament-cards-revamp` if Batch C ships; close any newly-opened entries from this scoping; surface any 13-5 / 13-6 / 13-7 forward-pointers) + README state-line update. 1 commit.

**Estimated total LOC delta:** 200-400 across all batches. **Estimated commit count:** 6-9.

---

## Acceptance criteria for 13-4 close

- Zero fictional claims in landing copy. Truthfulness audit (Item 1) passes a fresh read.
- Twenty 20 framed as skill-assessment offering, not tournament format.
- Mobile landing renders without dead-whitespace at 375/390/412 viewports (operator-side QA confirmation).
- /play tournament cards reflect the locked theme-coupling decision (D4.1).
- Favicon emits at all sizes (16/32/48/64/180/512); browser tab shows the mark; PWA install on Android Chrome shows the mark; Apple touch icon resolves on iOS Safari.
- `<meta name="theme-color">` set per locked decision (D5.2).
- `app/sitemap.ts` + `app/robots.ts` ship; sitemap.xml resolves at `/sitemap.xml`; robots.txt resolves at `/robots.txt`.
- Root layout exports `openGraph` + `twitter` metadata; OG image renders at `/opengraph-image` (or static asset URL); social link previews on Twitter / WhatsApp / iMessage / LinkedIn show the mark + tagline correctly.
- All existing test gates green (1393 unit + 166 integration + tsc + lint at 17-warning baseline + next build clean).
- 13-4 close-verify scan against fresh Vercel preview: 0 axe critical / 0 axe serious across the full anchor set (no a11y regression from Batch A copy changes).

---

## Operator-side actions banked

- **Truthfulness review.** D1.1 / D1.2 / D1.3 / D1.4 / D1.5 / D1.6 are all copy decisions that need user lock before Batch A ships. Expect a back-and-forth on the SocialProof + Quote dispositions; they're the largest deletions.
- **Mobile QA.** Batch B's runtime confirmation is browser-driven; needs human-side check on 375/390/412 viewports per the locked operational convention.
- **Favicon design lock.** D5.1 / D5.2 / D5.3 / D5.4 all need locked decisions; the design bundle is comprehensive but the install pipeline (parametric vs static) needs user pick.
- **Domain pointing prerequisite for OG/sitemap absolute URLs.** `metadataBase` and sitemap will reference `https://app.handibowls.co.za`. The DNS pointing happens at 13-7 (per plan §16 step 7). Until then, OG share previews + sitemap absolute URLs reference a domain that doesn't yet resolve — non-blocking for 13-4 scope but flagged.

---

## Unexpected findings during scoping

- **Design bundle delivered comprehensive, build-ready favicon + logo spec.** Not an "operator-side info needed" gap as initially worried. The bundle includes dimensions, two-tier (simple/rich) favicon variants, install snippet, theme-color spec, lockup variants (light/dark/cream/atomic-red), construction grid + clear-space, do/don't usage rules, and 4-preset color variants. **Build pipeline can reuse the existing `<Bowl />` component construction** — the design states "Same construction as the in-app `<Bowl />` component, locked to the canonical seed so every export matches."
- **`app/apple-icon.png` already exists** at root and is auto-emitted by Next.js conventional file routing. Means Batch D's apple-touch-icon work is partly done — just needs swap to the canonical mark + size confirmation (180×180 per design spec).
- **The hardcoded `theme_color: "#0A0A0A"`** in both `app/layout.tsx:47` and `public/manifest.webmanifest` lock the address-bar tint to ink. Design spec calls for atomic-red (`#D7261E`). This is the single cleanest "follow the design" call — D5.2 default to α (atomic-red).
- **NO existing `app/sitemap.ts` or `app/robots.ts`.** Greenfield. No legacy to migrate.
- **NO existing OG meta or OG image.** Also greenfield.
- **The Phase 14 backlog reconciliation (2026-05-02) explicitly tracks** the round-robin / sectional / drawn-pairs / ladder-league / DM-the-skip features as out-of-v1. Landing copy currently advertises all five. The truthfulness sweep is the v1-launch counterpart of that backlog reconciliation.

No defamatory or legally-risky claims surfaced.

No third-category fictions surfaced (everything fictional is either drop or replace; nothing requires a separate scoping pass).

---

## Decision count summary

| Item | Decisions to lock |
|---|---:|
| Item 1 — Landing truthfulness | 6 (D1.1 - D1.6) |
| Item 2 — Twenty 20 reframe | (folded into D1.5) |
| Item 3 — Mobile layout | 3 (D3.1 - D3.3) |
| Item 4 — /play tournament cards | 2 (D4.1 - D4.2) |
| Item 5 — Favicon + theme-color | 4 (D5.1 - D5.4) |
| Item 6 — SEO | 5 (D6.1 - D6.5) |
| **Total** | **20** |

20 decisions surfaced for user triage before Batch A opens.
