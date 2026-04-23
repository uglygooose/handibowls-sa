# HANDIBOWLS REBUILD PLAN — Henselite-Aesthetic Product Reshape

> **Document status.** Plan-mode. Single source of truth for the HandiBowls reshape. Claude Code executes **one phase at a time**, stops at every **Stop & report** checkpoint, and waits for explicit human approval before moving to the next phase.
>
> **Not a refactor.** Product reshape with a **fresh Supabase project**, fresh routing, fresh UI, a **Henselite-inspired visual identity** (splatter/speckle bright colours — no Henselite logo or naming anywhere), and three distinct role tiers. The existing codebase contributes **`lib/` primitives only** (seeding, bracket, handicap, round advance, completion). Everything else is deleted or rebuilt.
>
> **Product name.** HandiBowls. Henselite does not appear anywhere in the UI as a name or logo. Their influence is purely aesthetic — colour palette + speckle/splatter texture language lifted from their bowls product line.
>
> **Voice & discipline.** Same register as `AUDIT_REFACTOR_PLAN.md`: direct, precise, evidence-backed, phase-gated. No invented facts. Uncertainty flagged explicitly.

---

## Decisions locked (user, 2026-04-22)

| # | Decision | Impact |
|---|---|---|
| Q1 | Product stays **HandiBowls**. | No rename anywhere. |
| Q2 | **No Henselite logo or name** in UI. | Branding work = zero; aesthetic only. |
| Q3 | **Henselite colour palette + speckle/splatter aesthetic** is the visual direction. | Phase 1 builds a "speckle" design system with 9 bowl-inspired theme presets. |
| Q4 | **One demo club at launch** ("Demo Bowls Club"). | Phase 4 seeds a single demo club; heavy CSV-import hardening deferred. |
| Q5 | Payments = **placeholder page only**. | Entry fees visible but uncollected; `/payments` stub explains future options. |
| Q6 | **Email only** for comms. | SMS/Twilio deferred out of scope. |
| Q7 | **T20 rubric confirmed** (see Phase 10). Zones 1–8 are positional outcome sectors around the jack (compass rose). Gold ≥80%, Silver 65–79%, Bronze 50–64%, Fail <50%. Pass ≈60%. | Phase 10 ships a production rubric, not a draft. |
| Q8 | Handicap = **per-tournament toggle** by the admin creating the tournament. | Phase 6/7 expose `handicap_rule` at creation. |
| Q9 | **Triples is a first-class format.** | Phase 6 ships Singles/Pairs/Triples/Fours/Mixed Pairs. |
| Q10 | Supabase region **`af-south-1` preferred**, `eu-west-1` acceptable fallback. | Phase 0 picks region. |
| Q11 | **Impersonation deferred to v2 entirely.** No flag, no gated surface. | Decision confirmed 2026-04-23; feature-flag env var removed. |
| Q12 | **Dark mode deferred** to v2. | Phase 1 ships light only. |
| Q13 | **BowlsLink interop out of scope.** | No CSV/API integration. |

---

## Table of contents

1. Ground rules & context
2. Research baseline (visual + BSA + T20)
   - 2.3.1 T20 v2 rubric (district/national pathway variant)
3. Phase 0 — Fresh project setup & pre-rebuild teardown
4. Phase 1 — HandiBowls design system (Henselite-aesthetic, splatter/speckle)
5. Phase 2 — Database schema & RLS (fresh Supabase)
6. Phase 3 — Auth, role resolution, route groups, responsive shells
7. Phase 4 — Demo club setup (super-admin)
8. Phase 5 — Player onboarding & profile
9. Phase 6 — Tournament engine (port existing primitives)
10. Phase 7 — Tournament admin UI (desktop-focused)
11. Phase 8 — Tournament player UI (mobile-focused, offline-first)
12. Phase 9 — Green/rink booking
13. Phase 10 — T20 assessment module (production rubric)
14. Phase 11 — Player communication (email only)
15. Phase 12 — Cross-cutting (stats, history, calendar, optional handicap)
15b. Phase 12.5 — Design fidelity audit & polish
16. Phase 13 — Final polish, QA, go-live
17. Master delete list (old Handibowls)
18. Master keep & rename list (primitives to salvage)
19. App Review & Update Standards — final checklist
20. Residual open questions

---

## 1. Ground rules & context

**Stack (unchanged):** Next.js 16.1.1, React 19.2.3, TypeScript 5 (strict), Tailwind 4, `@supabase/ssr` 0.8.0, `@supabase/supabase-js` 2.90.1, Vitest, ESLint 9.

**Stack additions for the rebuild:** shadcn/ui (new-york, Tailwind v4 + React 19 registry), Radix primitives, Lucide icons, TanStack Query v5, TanStack Table v8 + TanStack Virtual, React Hook Form + Zod 4, `cmdk`, `react-hotkeys-hook`, `react-resizable-panels` (pinned v2), `@serwist/next` (PWA), `dexie` (IndexedDB for offline scoring), `sonner`, `date-fns`, `nanoid`, `@react-email/components`, `resend`.

**Roles:**
- **`super_admin`** — platform operator. Manages clubs, runs national tournaments.
- **`club_admin`** — runs their club(s). Runs club + district tournaments (when delegated), manages players, greens, T20.
- **`player`** — mobile-first. Scores, books, enters tournaments, receives email + in-app notifications, completes T20.

**Responsive split:** admin-on-desktop, player-on-mobile, shared primitives, route-group layouts. `(super-admin)/`, `(club-admin)/`, `(player)/` groups under `app/`, each with its own `layout.tsx`. Middleware gates by role. Tailwind mobile-first (`md:`=768, `lg:`=1024).

**Phase discipline.** Every phase has **Goal**, **Precondition**, **Steps**, **Verification**, **Success criteria**, **Stop & report**. Claude Code runs one phase per session. No invented facts. Atomic commits on a per-phase branch (`rebuild/phase-N-<slug>`).

**BLUF.** We are rebuilding HandiBowls on a fresh Supabase project with a bold, loud, speckled, Henselite-inspired aesthetic (but zero Henselite branding), a three-tier role model, a BSA-native tournament engine with all five disciplines, offline-first mobile scoring, a production-grade T20 assessment module using the confirmed rubric (positional zones; 50/65/80 bands), and email-only comms. One demo club at launch.

---

## 2. Research baseline

### 2.1 Visual identity — "Henselite-aesthetic" for HandiBowls

Derived from the user-supplied Henselite product image and `henselite.com` product line. Henselite bowls are famous for speckled, multi-colour, high-chroma finishes. Representative colour families observed:

- **Atomic Red / Classic Red** — speckled crimson, black flecks.
- **Ocean Blue** — cobalt/sapphire with turquoise splashes.
- **Sunburst Yellow** — deep yellow with black/green speckle.
- **Midnight** — near-black with rainbow confetti flecks.
- **Ruby / Pink** — hot magenta with black/white speckle.
- **Ocean Green / Teal** — mid-green with aqua and black flecks.
- **Grape / Violet** — purple with pink/white speckle.
- **White Speckle** — white base, multi-colour confetti.

**Design system consequence:**
- **Neutral light chrome** (off-white surfaces, near-black ink) for legibility on data-dense admin views.
- **Speckle / splatter accents** — background textures, card headers, hero sections, active-state indicators. Delivered as a reusable `<SpeckleLayer />` SVG at low opacity + a bolder `<SplatterAccent />` for corner accents.
- **"Bowl theme" per club** — each club picks one of 9 Henselite-inspired presets (Atomic Red, Ocean Blue, Sunburst, Midnight, Ruby, Ocean Green, Grape, White Speckle, Core Black). The preset drives primary accent, speckle colours, and banner chroma within the club's scope. Super-admin / platform pages default to Core Black.
- **No Henselite name, logo, monogram, or trademarked wordmark** anywhere — grep assertion at every phase exit.

**Approximated hex palette** (refined during Phase 1 from product photography):

| Preset | Primary | Speckle A | Speckle B | On-primary ink |
|---|---|---|---|---|
| Atomic Red | `#D7261E` | `#000000` | `#FAFAF7` | `#FFFFFF` |
| Ocean Blue | `#1E4DD8` | `#3FB8AF` | `#FAFAF7` | `#FFFFFF` |
| Sunburst | `#F5B700` | `#0A0A0A` | `#0E7C7B` | `#0A0A0A` |
| Midnight | `#0E1B3D` | `#D7261E` | `#F5B700` | `#FFFFFF` |
| Ruby | `#C2185B` | `#0A0A0A` | `#FAFAF7` | `#FFFFFF` |
| Ocean Green | `#0E7C7B` | `#3FB8AF` | `#0A0A0A` | `#FFFFFF` |
| Grape | `#6A1B9A` | `#EC407A` | `#FAFAF7` | `#FFFFFF` |
| White Speckle | `#F4F4F4` | `#D7261E` | `#1E4DD8` | `#0A0A0A` |
| Core Black *(default/platform)* | `#0A0A0A` | `#D7261E` | `#FAFAF7` | `#FFFFFF` |

**Typography:**
- Display — **Barlow Condensed** (700/900, italic for scoreboard moments; sporting-goods cursive feel without replicating Henselite's script).
- UI — **Inter** (400/500/600/700).
- Mono (scorecards) — **JetBrains Mono** tabular-nums.

**Tagline:** "HandiBowls — tournaments, scores, and skills in your pocket." (Not "Choice of Champions" — that is Henselite's.)

### 2.2 Bowls South Africa (confirmed facts)

- Body: Bowls South Africa (BSA), `bowlssa.co.za`. ~23,000 members, ~513 clubs.
- Hierarchy: **Club → District → Provincial Bowls Board → National (BSA)**.
- **20 official districts** (canonical seed data): Boland, Border, Bowls Gauteng North, Eden, Ekurhuleni, Eastern Province, Johannesburg, Kingfisher, KwaZulu-Natal Country, Limpopo, Mpumalanga, Natal Inland, North West, Northern Cape, Northern Free State, Port Natal, Sables, Sedibeng, Southern Free State, Western Province.
- Membership: single national DB; each member has a **BSA #** (opaque integer stored as text).
- **Disciplines shipped v1:** Singles, Pairs, Triples, Fours, Mixed Pairs (per Q9).
- **Scoring defaults (BSA 2026 CoP where applicable):**
  - Singles: 4 bowls, **21 shots up**.
  - Pairs: 3 bowls each, **18 ends**.
  - Triples: 3 bowls each, **18 ends** (club/district convention; configurable).
  - Fours: 2 bowls each, **15 ends** sectional / **21 ends** semi+final.
  - Mixed Pairs: 3 bowls each, **18 ends**.
- **Categories:** Men, Women, Mixed, Open. Age: Open, Veteran, Junior, U35.
- **Handicap:** no official BSA handicap. HandiBowls ships handicap as per-tournament toggle (Q8), off by default for BSA-scoped events.
- **Canonical UI terms:** rink (not "lane"); Skip / Third / Second / Lead; peel = drawn game; shots up; ends.

### 2.3 T20 assessment rubric — LOCKED (user-confirmed, Q7)

1. **Zones 1–8** are **positional outcome sectors around the jack** — a compass rose:
   - 1 = Front (Centre) — short, on line
   - 2 = Front (Right)
   - 3 = Wide (Right)
   - 4 = Back (Right)
   - 5 = Back (Centre) — long, on line
   - 6 = Back (Left)
   - 7 = Wide (Left)
   - 8 = Front (Left)
   Zone selection classifies **where the bowl finishes**, not a numeric point value per zone.
2. **Sections 1–2 (Jacks, Targets)** — L / R / Narrow (+ On-line / Wide) are **delivery outcomes** (where the bowl/jack finished vs intended line).
3. **Sections 3–7** — L/R = **forehand (R for right-handed) / backhand (L)**. The test evaluates both hands.
4. **Deliveries.** 8 bowls per round × 2 rounds = **16 bowls per distance**.
5. **Grading bands (working standard across districts):**
   - **Gold** ≥ 80%
   - **Silver** 65–79%
   - **Bronze** 50–64%
   - **Fail** < 50%
   - **Pass ≈ 60%** overall (some districts require per-section minimums).
6. **Use.** Player development + district/provincial squad selection. **Not** a handicap input.
7. **Assessor.** BSA-accredited coach, **Level 2 preferred**. Level 1 may assist but not sign off.
8. **Second marker.** Best practice, not strictly required.
9. **Reassessment.** Annual or on progression (district/national pathway).

### 2.3.1 — T20 v2 rubric (district/national pathway variant)

**Status.** Authored alongside v1-final in Phase 10; **not activated by default**. Activation per-club by super-admin after BSA Level 2 coach validation.

**Rationale.** v1-final tracks the official BSA T20. v2 adds finer granularity so the same digital system can differentiate elite district/provincial players without changing the physical test. v2 is a HandiBowls-authored variant — it is not "BSA T20". Positioning: standardised national digital assessment system with automated grading and player history tracking, built on top of the BSA rubric.

**Additions over v1:**

1. **A-zone precision split.** The A-grade (Front-Centre) zone splits into:
   - `A+` — bowl touches the jack or finishes inside an inner radius.
   - `A` — bowl finishes within the standard A-zone radius.
2. **Optional distance-bucket capture.** After the zone tap, the assessor records proximity-to-jack in three buckets:
   - `<10cm`
   - `10–30cm`
   - `30cm+`
   Nullable on v1 assessments; required on v2 assessments.
3. **UX rule — depth after the tap.** Primary interaction stays "tap where it finished". Distance bucket is a secondary sheet after wedge tap on A+/A (or any zone in "full distance capture" mode). Two taps per v2 delivery; under 3 seconds.
4. **Grading re-calibration gated by coach sign-off.** v2 grade bands must be re-weighted by a named BSA Level 2 coach at activation time. Capture coach name + accreditation number on the rubric row. v1's 50/65/80 bands do not carry across unchanged. Do not guess weighting at build time.

**Not in v2:**
- Exact millimetre measurement. This is not a measuring app.
- Retroactive re-grading of v1 assessments. Historical assessments remain immutably linked to v1.
- Automatic rollout. Each club opts into v2 explicitly.

### 2.4 Competitor feature baseline

Distilled from BowlR, BowlsLink, rollUp, Clubhub:
- Table-stakes: member profiles, tiered membership, online entry + payment, draw/fixture generation, end-by-end scoring, rink diary, bulk email, ladders, season archive, CSV export.
- Wedges we ship: **offline-first scoring**, **per-club bowl-colour theming** (novel), **Fair-Rink allocation**, **bracket PDF export**, **iCal club calendar**.

---

## 3. Phase 0 — Fresh project setup & pre-rebuild teardown

**Goal.** Clean state, fresh Supabase project, env vars, rebuild branch, teardown of old UI so no ghost routes collide.

**Precondition.** Audit refactor complete on `main`. `main` green (`pnpm typecheck && pnpm lint && pnpm test`). `.env.local` documented.

**Steps.**

1. **Branch from `main`:**
   ```bash
   git checkout -b rebuild/phase-0-teardown
   ```

2. **Create fresh Supabase projects:**
   - `handibowls-prod` — region `af-south-1` if available, else `eu-west-1` (**if `af-south-1` unavailable, ask the user to confirm `eu-west-1` before continuing**).
   - `handibowls-dev` — same region.
   - Capture anon key, service role key, DB URL, project ref for both.

3. **Env vars.** Update `.env.local` (dev keys only, not committed) and `.env.example` (blanked):
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   NEXT_PUBLIC_APP_URL=
   NEXT_PUBLIC_APP_NAME=HandiBowls
   RESEND_API_KEY=
   RESEND_FROM_EMAIL=no-reply@handibowls.co.za
   ```

4. **Teardown** (per §17). Delete **every** `app/` route except `app/layout.tsx`, `app/globals.css`, `app/favicon.ico` (these will be rewritten in Phase 1). Delete all old pages/components/API routes. **Preserve** `lib/tournaments/` primitives (§18). Delete old `supabase/migrations/` and old `types/database.types.ts`.

5. **Empty directory skeleton:**
   ```
   app/, components/, lib/, types/, public/, supabase/migrations/, tests/
   ```

6. **README rewrite.** HandiBowls, three-role model, stack, pointer to this plan.

7. **CI.** Confirm `.github/workflows/ci.yml` runs `typecheck && lint && test && build` on every PR.

**Verification.**
```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test   # only preserved lib tests
pnpm build  # may fail (no pages) — acceptable at Phase 0 exit
```

**Success criteria.**
- Fresh Supabase projects exist; keys captured in `.env.local`.
- `app/` contains only root stubs; no ghost pages.
- `lib/tournaments/` primitives preserved and green.
- README updated.
- Branch pushed.

**Stop & report.** Teardown diff summary, region chosen, test count. Await approval.

---

## 4. Phase 1 — HandiBowls design system (Henselite-aesthetic, splatter/speckle)

**Goal.** Encode a bold, loud, speckled, Henselite-inspired visual identity as Tailwind 4 theme tokens; ship the 9 "bowl theme" presets; build a primitive set; build `<SpeckleLayer />` and `<SplatterAccent />`.

**Precondition.** Phase 0 complete.

**Steps.**

1. **Install UI dependencies:**
   ```bash
   pnpm add class-variance-authority clsx tailwind-merge lucide-react sonner
   pnpm add -D @tailwindcss/postcss
   pnpm dlx shadcn@latest init   # new-york, Tailwind v4, React 19, CSS variables
   ```

2. **Fonts.** `app/layout.tsx` `next/font` loaders: Barlow Condensed (display), Inter (UI), JetBrains Mono (scorecards).

3. **Tailwind v4 theme** (`app/globals.css`): surfaces, ink, functional colours, radii, breakpoints via `@theme`; 9 theme-preset variable blocks attached to `html[data-theme="..."]`; no preset = Core Black default. Full CSS in the plan appendix (duplicated in the rebuild PR description).

4. **Light mode only** for v1 (Q12).

5. **`<SpeckleLayer />`** (`components/brand/SpeckleLayer.tsx`):
   - Renders a deterministic SVG (seeded) of 60–120 small circles at randomised positions using `--color-speckle-a` and `--color-speckle-b`.
   - Props: `density`, `opacity` (0.04–0.12), `seed`.
   - SSR-safe.

6. **`<SplatterAccent />`** — bolder SVG with 1–3 large blobs + drip tails, used as corner accents on hero cards.

7. **`<ThemeApplier />`** (Client Component) — sets `document.documentElement.dataset.theme` from the logged-in user's club preset (or `core-black` for super-admin pages). Wired in the root layout after Supabase session is known.

8. **Primitive set** (`components/ui/`, shadcn-generated where available):
   - `button.tsx` — variants `primary` / `secondary` / `ghost` / `outline` / `danger` / `link`; sizes `sm` 36 / `md` 44 / `lg` 52 / `xl` 56 (scorecard).
   - `input.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`.
   - `card.tsx` (+ `CardHeader` / `CardBody` / `CardFooter`; header supports optional `<SpeckleLayer />` backing).
   - `dialog.tsx`, `sheet.tsx`, `drawer.tsx` (Vaul), `dropdown-menu.tsx`, `tooltip.tsx`.
   - `table.tsx` (unstyled base).
   - `badge.tsx` (neutral/success/warning/danger/info/accent + `theme-primary`).
   - `toast.tsx` via Sonner.
   - `tabs.tsx`, `separator.tsx`, `skeleton.tsx`, `avatar.tsx`.
   - `command.tsx` (cmdk) with `CommandDialog`.

9. **Domain primitives** (`components/brand/`):
   - `HandiBowlsWordmark.tsx` — custom SVG wordmark (bold condensed italic). Variants `light` / `dark`.
   - `HandiBowlsMark.tsx` — stylised speckled bowl-circle mark.
   - `BowlChip.tsx` — small circular SVG swatch rendering a bowl in the active preset (theme picker).
   - `Scoreboard.tsx` — mono tabular-nums score cell; primary-colour highlight for the current shot.
   - `RinkBadge.tsx` — numbered rink pill.

10. **Navigation primitives** (`components/nav/`):
    - `AdminSidebar.tsx` — 256px desktop sidebar (collapsible to icon bar); near-black surface with 6% speckle; primary = active preset.
    - `PlayerBottomNav.tsx` — fixed, safe-area-aware, 64px; 5 tabs (Home / Play / Book / Tourneys / Me).
    - `TopBar.tsx` — wordmark left, user menu right.

11. **Layout primitives** (`components/layout/`):
    - `PageHeader.tsx` — h1 + actions; admin pages use `<SpeckleLayer />` backing.
    - `DataShell.tsx` — desktop resizable 2-pane (`react-resizable-panels` pinned v2).
    - `MobileShell.tsx` — top bar + bottom nav + `pb-20` content.

12. **Storybook-lite.** `app/(dev)/design/page.tsx` — dev-only, gated on `NODE_ENV !== 'production'`. Renders every primitive + a theme picker that toggles all 9 presets live.

13. **Tests.** Vitest snapshot on `Button`, `Card`, `Badge`, `HandiBowlsWordmark`, `SpeckleLayer`. Accessibility smoke via `jest-axe`. Playwright snapshot on `/design`.

**Verification.**
```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm dev    # /design — all 9 presets toggle cleanly; SpeckleLayer renders; no console errors
grep -riE "henselite|choice of champions" app components lib public   # must return zero
```

**Success criteria.**
- All 9 theme presets compile and swap live.
- `<SpeckleLayer />` and `<SplatterAccent />` SSR-safe and deterministic.
- All 20+ primitives render on `/design`.
- `Button size="xl"` = 56px.
- Bottom nav safe-area-aware on iOS Safari.
- Grep assertion (no Henselite name) passes.
- Snapshot tests green.

**Stop & report.** Screenshots of `/design` in 3 presets (Atomic Red, Ocean Blue, Sunburst), Tailwind build size, primitive inventory, grep result. Await approval.

---

## 5. Phase 2 — Database schema & RLS (fresh Supabase)

**Goal.** Clean, normalised schema on the fresh Supabase project with RLS policies enforcing the three-tier role model end-to-end. One demo club seeded (Q4).

**Precondition.** Phases 0 + 1 complete.

**Tooling.** Supabase CLI migrations in `supabase/migrations/`. One file per logical group, timestamped.

**Steps.**

1. **CLI setup:**
   ```bash
   pnpm add -D supabase
   npx supabase init
   npx supabase link --project-ref <handibowls-dev-ref>
   ```

2. **Migration 001 — enums** (all enums used across the app, including `club_theme_preset` with the 9 presets and `t20_grade` = `gold/silver/bronze/fail`; `message_channel` includes only `in_app` and `email` — no `sms` per Q6).

3. **Migration 002 — core identity:** `districts`, `clubs` (with `theme_preset club_theme_preset not null default 'atomic-red'`), `profiles`, `club_memberships`, `club_admin_assignments`.

4. **Migration 003 — seed the 20 BSA districts.**

5. **Migration 003b — seed the demo club** (Q4):
   ```sql
   insert into clubs (name, short_name, district_id, city, theme_preset)
   select 'Demo Bowls Club', 'Demo', id, 'Johannesburg', 'atomic-red'
   from districts where name = 'Johannesburg';
   ```

6. **Migrations 004–008** — greens/rinks (with `btree_gist` for no-overlap bookings), tournaments (with `handicap_rule handicap_rule not null default 'scratch'`), tournament_entries / teams / members, matches + match_ends, bookings, T20 tables (see Phase 10), messages/recipients/notifications (email-only channel).

7. **Migration 009 — JWT claim hook** attaching `role` and `club_ids` to `app_metadata`. Registered in Supabase Dashboard → Auth → Hooks.

8. **Migration 010 — RLS.** Enable on every table. Policy summary:
   - `super_admin`: all ops on all tables.
   - `club_admin`: scoped to `club_admin_assignments.club_id`s.
   - `player`: own profile + same-club members (non-PII); insert/update own entries, bookings, match submissions, T20 deliveries.
   Write at least one RLS unit test per role per table.

9. **Migration 011 — invites** (email-based, 14-day expiry).

10. **Migration 012 — consents** (POPIA T&C acceptance).

11. **Migration 013 — T20 rubric v1-final** (full JSON from Phase 10, seeded with `is_active = true`).

12. **Type generation:**
    ```bash
    npx supabase gen types typescript --project-id <dev-ref> > types/database.types.ts
    ```

13. **`lib/supabase/`** clients: `client.ts` (browser), `server.ts` (RSC / route handlers), `middleware.ts` (session refresh), `service.ts` (server-only service-role).

**Verification.**
```bash
npx supabase db reset
pnpm typecheck && pnpm test
```

**Success criteria.**
- Clean migration apply.
- 20 districts + 1 demo club seeded.
- T20 rubric v1-final active.
- RLS tests pass (player cannot leak across clubs; club_admin cannot write outside own club; super_admin sees all).
- JWT hook attaches claims.

**Stop & report.** Migration list, RLS matrix, rubric JSON sample. Await approval.

---

## 6. Phase 3 — Auth, role resolution, route groups, responsive shells

**Goal.** Supabase auth (email + magic link), role-gated middleware, three route-group shells with responsive nav.

**Precondition.** Phases 0–2 complete.

**Steps.**

1. **Middleware** (`middleware.ts` at repo root):
   - `/platform/*` → `super_admin` only.
   - `/manage/*` → `club_admin` + `super_admin`.
   - `/play`, `/book`, `/tournaments`, `/me` → authenticated.
   - Redirect to role home on wrong-prefix access.
   - Public: `/`, `/login`, `/signup`, `/invite/[token]`.

2. **Route group structure:**
   ```
   app/
   ├── layout.tsx
   ├── page.tsx
   ├── (auth)/login/page.tsx
   ├── (auth)/signup/page.tsx
   ├── (auth)/invite/[token]/page.tsx
   ├── (player)/layout.tsx
   ├── (player)/play/page.tsx
   ├── (player)/book/page.tsx
   ├── (player)/tournaments/page.tsx
   ├── (player)/tournaments/[id]/page.tsx
   ├── (player)/me/page.tsx
   ├── (club-admin)/layout.tsx
   ├── (club-admin)/manage/overview/page.tsx
   ├── (club-admin)/manage/members/page.tsx
   ├── (club-admin)/manage/greens/page.tsx
   ├── (club-admin)/manage/tournaments/page.tsx
   ├── (club-admin)/manage/t20/page.tsx
   ├── (club-admin)/manage/messages/page.tsx
   ├── (super-admin)/layout.tsx
   ├── (super-admin)/platform/clubs/page.tsx
   ├── (super-admin)/platform/districts/page.tsx
   ├── (super-admin)/platform/tournaments/page.tsx
   ├── (super-admin)/platform/rubrics/page.tsx
   └── (super-admin)/platform/users/page.tsx
   ```

3. **Layouts.** Root layout wires fonts, `<ThemeApplier />`, `<Toaster />`, `<QueryClientProvider />`, Supabase session listener. Each group layout re-checks role server-side (defence-in-depth behind middleware).

4. **Auth screens** — email + password (primary), magic link (fallback), `/invite/[token]` (sets password + links to an invite row).

5. **Role utility** (`lib/auth/role.ts`) — `requireRole(allowed: UserRole[])` used at the top of every group layout.

6. **Responsive policy.**
   - Player shell: mobile-first, bottom nav; at `md+` collapses to a degraded top-bar mode.
   - Admin shells: desktop-first; below `lg` show a drawer (`<Sheet>`) + a banner "Admin features are optimised for desktop."

7. **PWA scaffolding.** `public/manifest.webmanifest` (name "HandiBowls"; `display: standalone`; `start_url: "/play"`; `theme_color: #0A0A0A`; `background_color: #FAFAF7`; maskable icons). Register Serwist with runtime caching off (enabled in Phase 8).

8. **Tests.** Vitest: `requireRole` redirects in every role/path combination. Playwright smoke: three seed users land on correct homes; wrong-prefix redirects.

**Verification.**
```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm dev
# Seeded users (created in Supabase dashboard for dev):
#   super@handibowls.local    -> /platform/clubs
#   admin@demo.local          -> /manage/overview  (Demo Bowls Club; Atomic Red preset)
#   player@demo.local         -> /play             (Atomic Red preset applied)
```

**Success criteria.**
- Role-gated redirects enforced at middleware + group layouts.
- `data-theme` correctly applied from user's club preset.
- `app_metadata.role` resolves from JWT on first render (no client re-fetch).
- Lighthouse PWA ≥ 90.

**Stop & report.** Route tree, role-redirect outcomes, Lighthouse scores. Await approval.

---

## 7. Phase 4 — Demo club setup (super-admin)

**Goal.** Super-admin can edit the demo club, create additional clubs, invite a club admin, configure greens/rinks, invite initial players. Q4 = only the demo club is needed at launch; the wizard exists for future use and for Henselite's marketing demos.

**Precondition.** Phase 3 complete.

**Steps.**

1. **Page `/platform/clubs`** — TanStack Table: Name, District, City, Admin, Members, Greens, Theme, Active. "New club" button present.

2. **Page `/platform/clubs/new`** — multi-step wizard:
   - Step 1 — Club details: name, short name, district (20), city, contact email/phone, logo upload (Supabase Storage `club-logos` bucket), **theme preset picker** (9 `<BowlChip />` swatches with live preview).
   - Step 2 — Club admin: invite by email.
   - Step 3 — Greens & rinks (1–12 per green).
   - Step 4 — Initial players: single-row form primary; optional lightweight CSV.
   - Step 5 — Review & publish via RPC `create_club_with_dependencies`.

3. **Page `/platform/clubs/[id]`** — tabs: Overview, Admins, Greens, Members, Tournaments, **Theme**, Audit.
   - **Theme tab** — interactive preset picker with live preview of a sample club-admin dashboard in that preset.

4. **Page `/platform/districts`** — read-only (districts are fixed BSA data).

5. **Page `/platform/users`** — global user search (name / email / club). Read-only link-through to `/platform/users/[id]`. No impersonation surface (Q11 deferred to v2).

6. **Server actions** (`_actions.ts`):
   - `createClub`, `updateClubTheme`, `assignClubAdmin`, `createInvite` (writes `invites` row + calls Resend — Phase 11 finalises; dev shows invite link in console + dev banner).

7. **Tests.** Integration: update demo club theme to "Ocean Blue" → player logs in → `html[data-theme]` is `ocean-blue`.

**Verification.**
```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm dev  # manual: edit demo club; theme swap reflects for player
grep -riE "henselite|choice of champions" app components   # zero hits
```

**Success criteria.**
- Demo club fully editable; theme swap is live for players.
- Club-admin invite link works end-to-end (lands on `/invite/[token]`, sets password, redirects to `/manage/overview`).
- Greens/rinks CRUD works.
- No Henselite branding surfaced.

**Stop & report.** Demo-club config after wizard, theme-swap screenshots, grep result. Await approval.

---

## 8. Phase 5 — Player onboarding & profile

**Goal.** Club admin invites players; player completes profile on first login.

**Precondition.** Phase 4 complete; demo club admin exists.

**Steps.**

1. **Page `/manage/members`** — virtualised table. Columns: Name, Email, Phone, BSA #, Gender, Club grading, Status, Novice-until, Last active.

2. **Invite flows.**
   - Single-invite modal (email or phone; v1 = email per Q6).
   - Bulk CSV upload (light validation; Q4 = demo scale).
   - QR-code poster pointing to `/invite/club/[clubId]`.

3. **Player profile setup** (`/me/setup` — redirect if `profile_completed = false`):
   - Step 1 — identity (name, gender, DOB).
   - Step 2 — bowls (BSA #, membership number, club grading skip/third/second/lead, dominant hand).
   - Step 3 — contact (email locked from invite; phone; email-opt-in checkbox).
   - Step 4 — consent (T&Cs + privacy → `consents` row, capturing versions).
   - Flip `profile_completed = true`.

4. **Dual-club.** `is_primary` toggle on a membership; club switcher in top bar when a player has ≥ 2 memberships.

5. **Tests.** Full invite → accept → setup → `/play` flow.

**Success criteria.**
- Player cannot reach `/play` content until `profile_completed`.
- Novice badge auto-renders for 3 years after `novice_registered_at`.
- Invite status visible to admin (pending / accepted / expired).

**Verification.** `pnpm test && pnpm dev` full flow.

**Stop & report.** Flow log + DB state after 3 test invites. Await approval.

---

## 9. Phase 6 — Tournament engine (port existing primitives)

**Goal.** Port `lib/tournaments/` primitives into a cleaner folder; add format defaults for all 5 disciplines including Triples (Q9); wire handicap toggle (Q8). Keep all existing tests green.

**Precondition.** Phase 2 + 3 complete; preserved primitives (§18) present.

**Steps.**

1. **Preserved inventory:** `seeding.ts`, `bracket.ts`, `roundAdvance.ts`, `handicap.ts`, `matchComplete.ts`, `tournamentComplete.ts`, `components/brackets/BracketTree.tsx`.

2. **Rename & reorganise:**
   ```
   lib/tournaments/
   ├── seeding.ts
   ├── brackets/
   │   ├── knockout.ts          (was bracket.ts)
   │   ├── roundRobin.ts        (skeleton)
   │   └── sectional.ts         (skeleton)
   ├── rounds.ts                (was roundAdvance.ts)
   ├── handicap.ts
   ├── completion.ts            (match + tournament merged)
   ├── formats.ts               (format defaults)
   └── adapters.ts              (DB-row ↔ primitive shapes)
   ```

3. **`formats.ts` — BSA defaults:**
   ```ts
   export const FORMAT_DEFAULTS: Record<TournamentFormat, FormatDefault> = {
     singles:     { bowlsPerPlayer: 4, scoringModel: 'shots_up',   shotsTarget: 21 },
     pairs:       { bowlsPerPlayer: 3, scoringModel: 'fixed_ends', endsTarget: 18 },
     triples:     { bowlsPerPlayer: 3, scoringModel: 'fixed_ends', endsTarget: 18 },
     fours:       { bowlsPerPlayer: 2, scoringModel: 'fixed_ends', endsTarget: 15 },
     mixed_pairs: { bowlsPerPlayer: 3, scoringModel: 'fixed_ends', endsTarget: 18 },
   };
   ```

4. **Handicap (Q8).** `handicap_rule` on `tournaments`; `lib/tournaments/handicap.ts` only applies when `handicap_rule === 'handicap_start'`. The UI exposes this toggle at tournament creation in Phase 7.

5. **Adapter layer.** `adapters.ts` — pure functions converting between DB rows and primitive shapes. No DB I/O.

6. **Server actions** (`app/(club-admin)/manage/tournaments/_actions.ts` + `(super-admin)` mirror): `createTournament`, `closeEntries`, `seedEntries`, `generateBracket`, `advanceRound`, `submitMatch`, `confirmMatch`, `verifyMatch`, `completeTournament`, `cancelTournament`.

7. **Tests.** Port all existing unit tests verbatim. Add tests for Triples defaults and handicap-rule branches. Target ≥ 90% coverage on `lib/tournaments/`.

**Verification.** `pnpm test --coverage`.

**Success criteria.**
- All primitive tests green.
- All 5 formats covered.
- Handicap rule honoured only when toggled on.

**Stop & report.** Coverage report. Await approval.

---

## 10. Phase 7 — Tournament admin UI (desktop-focused)

**Goal.** Data-dense desktop UI to create/edit tournaments, manage entries, draw brackets, bulk-enter scores, advance rounds, close tournaments. Handicap toggle and entry fee exposed at creation (Q5, Q8).

**Precondition.** Phase 6 complete.

**Steps.**

1. **Page `/manage/tournaments`** — list with filters (status / format / scope).

2. **Page `/manage/tournaments/new`** — form:
   - "Basics" — name, scope (club/district/national; district/national gated by super-admin), format (Singles / Pairs / Triples / Fours / Mixed Pairs), structure (knockout / round_robin / sectional / drawn_social), category, age group, dates, max entries.
   - **"Handicap" toggle** — `Scratch` (off, default) / `Handicap start` (on). Explainer: "Handicaps are club-internal only and will be applied as starting-shot advantages."
   - "Rules" — auto-filled from `FORMAT_DEFAULTS[format]`, editable (ends target, shots target, bowls per player, sectional size).
   - "Greens" — pick rinks available; Fair-Rink toggle.
   - **"Entry fee"** — number input with subtext: "Payments portal coming soon — fees are displayed only for now." (Q5)

3. **Page `/manage/tournaments/[id]`** — tabs:
   - **Entries** — table with inline seeds; manual paid flag; withdrawals.
   - **Draw** — `<BracketTree>` for knockout; sectional grid for round-robin; "Generate" calls `generateBracket`.
   - **Scoring** — bulk-entry grid; keyboard-first (Arrows / Enter to save / Shift+Enter to save & advance); validation against `endsTarget` / `shotsTarget`.
   - **Rinks** — Fair-Rink heatmap + redraw.
   - **Comms** — quick message to entrants (delegates to Phase 11).
   - **Audit** — event stream.

4. **Command palette** (`⌘K`): "Advance round 2", "Open next incomplete match", "Search team X", "Forfeit match #234", "Print draw (PDF)".

5. **PDF exports** via `@react-pdf/renderer`: Draw sheet, Round scoresheet, Final results. Club preset colour in header stripe.

6. **`/payments` placeholder page** (linked from tournament detail where entry_fee_cents > 0). Copy explains future integration options (Peach Payments, Yoco, Stripe) with a contact link. Plain, bone-coloured background; speckle accent in the header; no false "Pay now" buttons.

7. **Tests.** Playwright: create a 16-player Singles Handicap-on knockout → seed → generate → bulk-score round 1 → advance → complete.

**Success criteria.**
- 16-player knockout authored + scored in < 4 min in Playwright.
- Handicap toggle flows through to `matches.*_handicap_start`.
- Bulk-score grid virtualised (50+ matches without jank).
- Bracket tree renders for 64-team draw inside a resizable panel without overflow.
- PDF exports include club theme colour in header.
- `/payments` page exists and is linked correctly.

**Stop & report.** Playwright run + PDFs + placeholder page screenshot. Await approval.

---

## 11. Phase 8 — Tournament player UI (mobile-focused, offline-first)

**Goal.** Mobile-first scoring flow; captains submit, opponents confirm, admin overrides. Works offline on wet greens.

**Precondition.** Phase 7 complete.

**Steps.**

1. **Pages:**
   - `/tournaments` — list of tournaments the player can enter (filtered by club, scope, category, age group, gender eligibility) + tournaments they're already in.
   - `/tournaments/[id]` — dashboard (status, next-match card, mini-bracket, standings, schedule).
   - `/tournaments/[id]/matches/[matchId]` — **the scorecard**.

2. **Scorecard UX (mobile-first).**
   - Big team names top/bottom.
   - `+` / `-` buttons per side per end, 56×56px.
   - Running total monospace 48px centre.
   - End counter + target reminder ("End 6 of 18" or "Shots up: 14/21").
   - "End done" commits one `match_ends` row locally.
   - "Submit final" sets `status = captain_submitted` and notifies opposing captain.
   - Wake-lock on; haptic tap (10ms).
   - "Wet hands mode" toggle (bigger buttons, high-contrast yellow/black).
   - Only one captain per side submits; admin sees both.
   - SpeckleLayer accent in header using the club theme preset.

3. **Offline-first architecture.**
   - Local store: **Dexie** (`lib/offline/db.ts`) with stores `matches`, `match_ends`, `outbox`.
   - Reads cached via Service Worker (Serwist); writes optimistic to Dexie, enqueue to `outbox`, background-sync on online.
   - Conflict rule for `match_ends`: **last-write-wins by `(match_id, end_number)`**.
   - Conflict rule for `match.home_score/away_score`: server rolls up from `match_ends`; client never writes totals directly.
   - Sync indicator in top bar: "All saved" / "3 ends pending sync".

4. **Opponent confirmation.** Opposing captain sees "Match ready to confirm" notification → confirm moves status to `opponent_confirmed`; mismatch triggers "Dispute" flow surfacing to admin.

5. **Bracket view on mobile.** Horizontal scroll, snap-to-round; tap a match to open its card. Current-player's next match highlighted with theme-primary indicator.

6. **PWA — real offline.**
   - Serwist: precache shell (`/play`, `/tournaments`, `/tournaments/[id]`, match route); runtime-cache GET `/api/match/*` (network-first, 24h); never cache mutations.
   - Install prompt after 2nd successful load + 1st scorecard open.

7. **Tests.** Vitest: Dexie outbox fills/flushes/deduplicates on reconnect. Playwright: devtools offline → score an 18-end match → reload → reconnect → assert server state.

**Success criteria.**
- Full 18-end Pairs match scored offline and synced within 10s on reconnect.
- Dispute path works.
- Lighthouse PWA ≥ 95 on `/play`.
- Scorecard buttons ≥ 56px; axe smoke test passes.

**Stop & report.** Lighthouse + Playwright offline log. Await approval.

---

## 12. Phase 9 — Green/rink booking

**Goal.** Admin configures availability; players book rinks from mobile; double-booking impossible at the DB layer.

**Precondition.** Phase 5 complete; greens/rinks exist.

**Steps.**

1. **Admin `/manage/greens`** — grid per green + weekly availability editor (`booking_windows`); rink-disable toggle (e.g. maintenance).

2. **Player `/book`** — mobile-first: date picker (default today); time-slot grid with available rinks per slot (coloured by green); tap → modal with purpose (roll-up / practice / coaching / match / social), party size, optional notes; submit writes `bookings` row; GIST exclusion constraint blocks overlaps.

3. **"My bookings" on `/me`** — upcoming + history; cancel up to 2h before start.

4. **Admin "Bookings" calendar tab** on `/manage/overview` — weekly grid + override (force-book / cancel) with audit entry.

5. **Reminders.** Notification 2h before start (Phase 11 pipeline).

6. **Fair-Rink hints.** Booking UI soft-deprioritises rinks most-allocated in tournaments this season.

7. **Tests.** Integration: two players target the same rink + slot → second booking rejected cleanly.

**Success criteria.**
- Zero double-bookings possible at DB (GIST verified).
- Player books in ≤ 4 taps.
- Admin override creates an audit record.

**Stop & report.** Concurrency test log + UI screenshots. Await approval.

---

## 13. Phase 10 — T20 assessment module (production rubric)

**Goal.** Digitise T20 using the **confirmed rubric** from Q7. Production-grade, not draft.

**Precondition.** Phase 2 + 5 complete.

**Locked rubric (Q7):**
- 8 bowls per round × 2 rounds = 16 per distance.
- Zones 1–8 = positional outcome sectors around the jack (compass: 1 Front-Centre, 2 Front-Right, 3 Wide-Right, 4 Back-Right, 5 Back-Centre, 6 Back-Left, 7 Wide-Left, 8 Front-Left).
- Sections 1–2: L / R / Narrow / On-line / Wide (delivery outcome).
- Sections 3–7 hand: L = backhand, R = forehand (for a right-hander).
- Grading: Gold ≥ 80%, Silver 65–79%, Bronze 50–64%, Fail < 50%. Pass ≈ 60%.
- Use: development + squad selection. **Not** handicap.
- Assessor: BSA-accredited coach, Level 2 preferred.
- Reassessment: typically annual or on progression.

**Steps.**

0. **Migration `016_t20_distance_bucket.sql`** — adds nullable `distance_bucket text` column to `t20_deliveries`, CHECK-constrained to `('<10cm','10-30cm','30cm+')` or null. Backwards-compatible with v1. Regenerate types.

1. **Rubric v1-final JSON (seeded migration 013):**
   ```json
   {
     "version": "v1-final-2026",
     "deliveriesPerRoundPerDistance": 8,
     "rounds": 2,
     "sections": {
       "jacks": {
         "distances_m": [23, 26, 29, 32],
         "model": "line_outcome",
         "points": { "on_line": 1, "narrow": 0.5, "wide": 0 },
         "max_per_distance": 16
       },
       "targets": {
         "distances_m": [23, 26, 29, 32],
         "model": "line_outcome",
         "points": { "on_line": 1, "narrow": 0.5, "wide": 0 },
         "max_per_distance": 16
       },
       "drive":   { "distance_m": 28, "model": "zones_8", "hands": ["fore","back"], "zonePoints": { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, "miss": 0 } },
       "control": { "distance_m": 28, "model": "zones_8", "hands": ["fore","back"], "zonePoints": { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, "miss": 0 } },
       "trail":   { "distance_m": 28, "model": "zones_8", "hands": ["fore","back"], "zonePoints": { "1": 8, "2": 5, "3": 2, "4": 4, "5": 6, "6": 4, "7": 2, "8": 5, "miss": 0 } },
       "speedhumps_asc":  { "ladder_m": [23, 26, 29, 32], "model": "on_length", "pointsPerOnLength": 2 },
       "speedhumps_desc": { "ladder_m": [32, 29, 26, 23], "model": "on_length", "pointsPerOnLength": 2 }
     },
     "grading": [
       { "grade": "gold",   "minPct": 80 },
       { "grade": "silver", "minPct": 65 },
       { "grade": "bronze", "minPct": 50 },
       { "grade": "fail",   "minPct": 0 }
     ],
     "passPctTarget": 60,
     "assessor": { "minLevel": 2, "secondMarkerRecommended": true }
   }
   ```

2. **Admin setup `/manage/t20`:**
   - List of assessments (player, date, grade, assessor).
   - "New" → pick player + assessor (default self if accredited) + date + green type + optional green speed.
   - Assessor declares accreditation ID (stored in `assessor_accreditation_id`).

3. **Capture UI (7 sections × 2 rounds)** — tablet/mobile wizard:
   - Sections 3–5 use an interactive `<CompassPicker />` rendering the exact compass diagram (user-supplied image): 8 wedges labelled 1–8 with the Front/Wide/Back + Centre/Left/Right labels. Tapping a wedge selects. Plus a hand toggle (Fore / Back).
   - Sections 1–2: rows per distance × round; tap On-line / Narrow L / Narrow R / Wide L / Wide R per delivery.
   - Sections 6–7: length ladder rungs with Fore/Back + on/off per delivery.
   - Live subtotal + running grand total at the bottom.
   - Autosave every 5s (online-only for v1 — assessments generally happen at the club with Wi-Fi).

4. **Results view `/manage/t20/[id]`:**
   - Section subtotals, grand total, percentage, **grade** (Gold / Silver / Bronze / Fail) as a coloured pill.
   - Hand balance chart (Fore vs Back across sections 3–7).
   - Length chart (per-distance accuracy).
   - "Second marker" field — optional text entry capturing observer's name.
   - PDF export matching the physical T20 sheet layout + a summary page with zone distribution.

5. **Platform `/platform/rubrics`** — super-admin uploads new rubric versions (validated JSON); activates one at a time; historical assessments immutably linked to their version.

6. **T20 v2 rubric authoring (seeded, not activated).**
   - Seed `t20_rubric_versions` with `version = 'v2-draft-2026'`, `is_active = false`, rubric JSON implementing the A+/A split with placeholder weights flagged `pending_coach_signoff: true`.
   - `/platform/rubrics` gains an "Activate" action:
     a. Super-admin only.
     b. Requires BSA Level 2 coach accreditation number + coach name at activation.
     c. Stores both on the rubric version row before flipping `is_active`.
     d. Writes an audit row.
   - v2 capture UI extends `<CompassPicker />` with a secondary distance-bucket sheet, shown only when the active rubric version's JSON includes `distanceBucket: { required: true }`.
   - `<CompassPicker />` API stays stable; distance sheet is a config-toggled child component.

7. **Tests.**
   - Unit: scoring calculator per section model (`line_outcome`, `zones_8`, `on_length`).
   - Unit: grading mapper edge cases (79% Silver, 80% Gold, 49% Fail).
   - Integration: capture a full assessment → stored rows → correct grade.

**Success criteria.**
- Assessor completes a full 7-section × 2-round assessment in ≤ 25 minutes on a tablet.
- Every delivery stored normalised in `t20_deliveries`.
- Grade calculated correctly against the locked rubric.
- PDF export matches the physical sheet layout (portrait, zones legend, compass diagram).
- Historical assessments retain their rubric version.
- v2 rubric seeded, not activated. Activation flow requires coach accreditation capture.
- `distance_bucket` column present, nullable, CHECK-constrained.
- v1 assessments unchanged and still gradeable.
- Positioning copy uses "standardised national digital assessment system" language, not "simplified scoring tool".

**Stop & report.** Capture flow screenshots + sample PDF + unit test coverage on scoring. Await approval.

---

## 14. Phase 11 — Player communication (email only)

**Goal.** Club admin broadcasts to players via in-app notifications + email (Q6 — no SMS).

**Precondition.** Phase 5 complete.

**Steps.**

1. **Email provider: Resend.** `@react-email/components` templates: `InviteEmail`, `TournamentAnnouncement`, `MatchReminder`, `BookingReminder`, `GenericBroadcast`. Every template uses the club theme preset's primary colour in the header strip and a subtle speckle SVG accent.

2. **Admin `/manage/messages`:**
   - List (status, scope, recipient count, sent-at).
   - Compose: subject, markdown body, channel (in_app always; email optional), audience (all club members / tournament entrants / custom selection via multi-select table), schedule (now / later).
   - Preview panel renders the email template live.

3. **Send pipeline.** Supabase Edge Function `send-message` (Deno, `supabase/functions/send-message/`):
   - Fans out into `message_recipients` + `notifications`.
   - Email via Resend in batches of 100 with retry/backoff.
   - Transitions `messages.status` through `queued → sent`.

4. **Player inbox `/me/inbox`** — list of notifications + `message_recipients`; tap marks read.

5. **Realtime.** Supabase channel `notifications:profile_id=eq.<id>` → top-bar bell + unread badge.

6. **Compliance.** POPIA-compliant unsubscribe link in every email; mandatory sender address; per-user email opt-out honoured next send; per-club daily broadcast cap (default 2, configurable).

7. **Tests.** Edge function: fan-out to 500 recipients produces 500 rows + batches Resend calls correctly.

**Success criteria.**
- Broadcast to 500 players delivered (in-app + email) within 30s.
- Unsubscribes respected on next send.
- Bell updates within 1s.
- No SMS code path in the bundle (grep).

**Stop & report.** Delivery run log + latency percentiles + grep result. Await approval.

---

## 15. Phase 12 — Cross-cutting (stats, history, calendar, optional handicap)

**Goal.** Ship differentiating value: player stats, results history, event calendar, club-optional handicap.

**Precondition.** Phases 4–9 complete.

**Steps.**

1. **Results history.** SQL view `v_match_results` (match + teams + tournament + scores). `/me/results` (last 50). Public `/results/[clubSlug]` (surname-initial for non-logged-in; privacy-preserving).

2. **Player stats.** SQL views aggregating career W/L, % ends won, most-played partner/opponent, by position, by format. `/me/stats` with shadcn Chart (Recharts).

3. **Event calendar.** Unified calendar (tournaments + socials + fixtures). iCal feed `/api/clubs/[id]/calendar.ics` (Bearer token). Migration 014 adds `events` table.

4. **Handicap (club-scoped).**
   - `clubs.handicap_enabled boolean default false`.
   - `profiles.handicap int default 0`.
   - `/manage/handicaps` — manual edit + optional auto-recalc from last N matches (off by default).
   - Tournament creation already toggles `handicap_rule` (Q8).
   - Label clearly: "Club-internal handicap — not endorsed by BSA."

5. **Fair-Rink allocation.** Per-tournament toggle in Rinks tab: heatmap + re-shuffle biased toward under-used rinks.

6. **Tests.** SQL view snapshots; stat aggregator unit tests.

**Success criteria.**
- `/me/stats` renders for a player with 20+ matches in < 500ms.
- Calendar feed validates against iCal spec.
- Handicap disabled by default and only affects tournaments with `handicap_rule = handicap_start`.

**Stop & report.** Stats render time + calendar validator output. Await approval.

---

## 15b. Phase 12.5 — Design fidelity audit & polish

**Goal.** Walk every Claude Design brief output vs the shipped surface. Close every open `DRIFT_LOG.md` item scoped to this phase. Bring shipped surfaces back to full Claude Design fidelity before Phase 13's technical polish pass.

**Precondition.** Phases 0–12 complete. `DRIFT_LOG.md` maintained throughout.

**Inputs.** All Claude Design brief outputs (Design System, Landing + Auth, Admin + Tournament, Player + Scorecard, T20 compass) and their reference screenshots.

**Steps.**
1. Fidelity diff: for each Claude Design surface, Playwright-screenshot current state at reference breakpoints. Compare against reference. Log any new drift not already in `DRIFT_LOG.md`.
2. Close every Phase 12.5 item in dependency order (design-system first, then surfaces).
3. Each fix is its own commit, referencing the `DRIFT_LOG.md` line it closes.
4. No scope creep — only items already logged. New drift gets logged first, then fixed.

**Verification.**
- Phase 12.5 subsection of `DRIFT_LOG.md` has zero open items.
- Visual diff vs Claude Design reference within tolerance on every surface.
- `npx tsc --noEmit && npm run lint && npm test && npm run build` all green.

**Stop & report.** Drift log before/after counts, side-by-side screenshots per surface, commit list.

---

## 16. Phase 13 — Final polish, QA, go-live

**Goal.** Ship-ready: performance, a11y, security, SEO, monitoring, content, domain, analytics, launch checklist.

**Precondition.** Phases 0–12 complete.

**Steps.**

1. **Performance.** Lighthouse on top routes. Targets: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, PWA ≥ 95 on player routes. Fix N+1s via joins/RPCs.

2. **Accessibility.** Axe + keyboard pass on every page. Contrast audit across all 9 theme presets.

3. **Security.**
   - RLS audit (`supabase inspect db`).
   - Service-role key never in client bundle (grep).
   - Rate-limit auth (Supabase built-in).
   - CSP headers in `next.config.ts`.
   - POPIA consent audit.

4. **SEO / marketing.**
   - `/` landing — HandiBowls brand story (tournaments + scoring + T20 in your pocket; **zero Henselite mention**), feature grid, demo CTA pointing to Demo Bowls Club.
   - OG images, sitemap, robots.

5. **Monitoring.** Sentry + Supabase log drain + Better Stack uptime.

6. **Content.**
   - Onboarding checklists per role.
   - `/help` seed articles: creating a tournament, scoring a match, booking a rink, T20 walkthrough.

7. **Domain & email.** Point `app.handibowls.co.za` to Vercel. Configure DMARC/DKIM/SPF for Resend.

8. **Final QA.** Full Playwright regression: super-admin flow, club-admin flow, player flow, offline scoring, messaging, T20.

9. **Launch checklist (§19).** Every item ticked; explicit sign-off.

**Success criteria.**
- Lighthouse targets met on all top routes.
- Axe: zero serious/critical.
- Full suite green in CI.
- Demo Bowls Club live with seed data for Henselite marketing demos.
- Grep assertion: zero "henselite" / "choice of champions" strings in code or assets.

**Stop & report.** Lighthouse / axe / Playwright reports + signed-off checklist + grep result. Await final go-live approval.

---

## 17. Master delete list — removed from old Handibowls (Phase 0)

Everything under `app/` except `app/layout.tsx`, `app/globals.css`, `app/favicon.ico` (these are rewritten in Phase 1). Concretely:

- All old pages, layouts, route handlers outside the stub list.
- All old API routes under `app/api/**`.
- All old components except the § 18 list.
- Hooks/contexts/providers not tied to preserved primitives.
- Old DB artefacts: `supabase/migrations/**`, `types/database.types.ts`, `lib/db/**`.
- Old auth helpers under `lib/auth/`.
- Old email templates under `emails/`.
- Old styles beyond `globals.css`.
- Old brand assets (`public/logo*`, old `public/favicon*`).
- Old UI tests (`tests/**/*.ui.test.*`); lib tests kept.
- `AUDIT_REFACTOR_PLAN.md` kept as reference; superseded by this document.
- Old env vars no longer used — pruned from `.env.example`.

Ambiguous files → Claude Code stops and asks.

---

## 18. Master keep & rename list — primitives preserved

| Old path | New path | Notes |
|---|---|---|
| `lib/tournaments/seeding.ts` | `lib/tournaments/seeding.ts` | Unchanged API. |
| `lib/tournaments/bracket.ts` | `lib/tournaments/brackets/knockout.ts` | Moved; same exports re-exported. |
| `lib/tournaments/roundAdvance.ts` | `lib/tournaments/rounds.ts` | Renamed. |
| `lib/tournaments/handicap.ts` | `lib/tournaments/handicap.ts` | Applied only when tournament `handicap_rule = handicap_start`. |
| `lib/tournaments/matchComplete.ts` + `tournamentComplete.ts` | `lib/tournaments/completion.ts` | Merged. |
| `components/brackets/BracketTree.tsx` | `components/brackets/BracketTree.tsx` | Logic unchanged; restyled with Phase 1 tokens + speckle accent. |
| Pure utils in `lib/utils/*` | `lib/utils/*` | Only passing-test utilities kept. |
| Tournament Zod schemas | `lib/validation/tournament.ts` | Updated to new types. |
| Existing lib unit tests | `tests/lib/tournaments/**` | Verbatim; green before Phase 6 exits. |

Everything else rebuilt fresh.

---

## 19. App Review & Update Standards — final checklist (per phase + at go-live)

- [ ] Zero commented-out code.
- [ ] Zero unused imports/variables (ESLint clean).
- [ ] TypeScript strict — no `any`, no `// @ts-ignore`, no `as unknown as`.
- [ ] Consistent naming: `camelCase` vars/functions, `PascalCase` components/types, `UPPER_SNAKE` constants, `kebab-case` files.
- [ ] Server Components fetch their own data; no client-side fetch for initial render.
- [ ] Every Client Component has `'use client'` + a clear reason.
- [ ] Every fetch/Supabase call has error handling + typed return.
- [ ] Every form Zod-validated client + server.
- [ ] Every DB mutation via Server Action or Route Handler; RLS authoritative.
- [ ] Every table has RLS enabled.
- [ ] No service-role key in client bundle (grep).
- [ ] No unhandled promise rejections in dev console.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all clean.
- [ ] Lighthouse PWA ≥ 95 on `/play`; Perf ≥ 90 on top routes.
- [ ] Axe: zero serious/critical.
- [ ] `loading.tsx` + `error.tsx` on every route.
- [ ] Player pages mobile-first (320px ref); admin pages desktop-first (1280px ref).
- [ ] BSA canonical terms (rink, Women, Shots up, peel).
- [ ] Dates UTC in DB, displayed `Africa/Johannesburg`.
- [ ] Currency in integer cents (ZAR).
- [ ] Secrets in env vars, documented in `.env.example`.
- [ ] CI runs on every PR; red blocks merge.
- [ ] Every phase has a PR linking back to this document.
- [ ] **Grep confirms zero `henselite` / `choice of champions` strings** in code or assets.

---

## 20. Residual open questions

**Q10 — Region.** If `af-south-1` is unavailable at project creation, confirm `eu-west-1` is acceptable.

**Q3 — Hex exactness.** The 9 theme presets use approximated hex values from product photography. If exact Pantone/HEX from a Henselite brand asset or a physical bowl swatch is available, Phase 1 incorporates them before sign-off. Non-blocking — approximations are coherent.

**T20 zone-point weighting.** The zone-point mapping in rubric v1-final (Front-Centre = 8, Back-Centre = 6, Front-sides = 5, Back-sides = 4, Wide = 2) is a reasoned interpretation of "closest-to-jack-on-line is best". If specific districts use different weightings, they diverge. Low risk — the rubric is versioned and swappable without schema changes.

---

## Closing note

Thirteen atomic phases. Phases 0–3 lay the foundation (teardown, design system, schema, auth). Phases 4–5 establish identity (demo club, players). Phases 6–8 are the tournament product (engine, desktop admin UI, offline-first mobile player UI). Phases 9–11 are the club product (booking, T20, email comms). Phases 12–13 differentiate and ship.

The plan preserves every line of the existing seeding / bracket / round / handicap / completion primitives and reuses them untouched behind a cleaner adapter. Everything else is rebuilt against a coherent three-role, responsive, BSA-native, offline-capable architecture — wrapped in a loud, speckled, Henselite-inspired visual identity that is entirely HandiBowls in name.
