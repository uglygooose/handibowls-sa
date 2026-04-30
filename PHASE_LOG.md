# HandiBowls — Phase Log

A one-entry-per-phase ledger captured at the moment each phase is declared
complete. The append-on-close protocol is part of phase discipline: **the
last action before pushing a phase branch is appending that phase's entry
here**. Anything older than Phase 7 is backfilled from `git log`, the
phase branches' tip SHAs, the rebuild plan, and `DRIFT_LOG.md` — entries
read "(not captured)" rather than fabricated values where the source of
truth is genuinely missing.

The counts of drift items (open / closed) refer to `DRIFT_LOG.md` totals
at the moment a phase closed, derived from
`grep -c "^- \[ \]" DRIFT_LOG.md` / `grep -c "^- \[x\]" DRIFT_LOG.md`.

---

## Phase 0 — Teardown — closed 2026-04-22

- **Branch tip:** `c075c7c` (`rebuild/phase-0-teardown`)
- **Sub-checkpoints:** delete old app routes/layout/page/globals · delete old
  `lib/auth`, `lib/supabase`, `lib/database.types.ts` · delete old supabase
  migrations (fresh project in Phase 2) · delete old Ridge Park brand assets
  · add HandiBowls README + `.env.example` + skeleton dirs + CI · add
  rebuild plan doc.
- **Migrations:** none (Phase 2 reseeds from scratch).
- **Drift delta:** (not captured).
- **Manual QA:** (not captured).

---

## Phase 1 — Design system — closed 2026-04-22

- **Branch tip:** `ad8b74a` (`rebuild/phase-1-design-system`)
- **Sub-checkpoints:** install UI deps · shadcn init · fonts + design-system
  tokens · `SpeckleLayer` / `SplatterAccent` / `ThemeApplier` · shadcn UI
  primitives + Button size scale override · domain brand primitives · nav
  primitives · layout primitives · component tests + vitest jsdom setup ·
  extract shared preset palette to `lib/brand/presets.ts` · add `Bowl`
  primitive · replace `SplatterAccent` + add `SpeckleField` / `SpeckleRule`
  · rewrite `/design` as HandiBowls Brand Book · grep guard against
  Henselite branding (zero hits).
- **Migrations:** none.
- **Drift delta:** (not captured).
- **Manual QA:** (not captured).

---

## Phase 2 — Schema — closed 2026-04-22

- **Branch tip:** `7f27567` (`rebuild/phase-2-schema`)
- **Sub-checkpoints:** supabase init + CLI dev dep · 13 migrations (001
  enums → 013 T20 rubric v1) · disable storage + analytics locally
  (Windows Docker TCP unavailable) · fix RLS recursion via SECURITY
  DEFINER helpers · register custom_access_token_hook · add Supabase
  client variants + generated `Database` types · RLS integration test
  harness.
- **Migrations:** 001 enums · 002 core identity (districts, clubs,
  profiles, memberships) · 003 + 003b seed 20 BSA districts + Demo Bowls
  Club · 004 greens / rinks · 005 tournaments / entries / teams /
  matches / ends · 006 bookings (GIST no-overlap) · 007 T20 rubric ·
  008 messages / recipients / notifications (in_app + email) · 009 JWT
  hook · 010 RLS · 011 invites · 012 consents · 013 T20 rubric v1.
- **Drift delta:** (not captured).
- **Manual QA:** (not captured).

---

## Phase 3 — Auth + shells — closed 2026-04-23

- **Branch tip:** `10f4fc4` (`rebuild/phase-3-auth-shells`)
- **Sub-checkpoints:** role helpers + middleware · route groups + responsive
  shells + root layout providers · auth screens (password + magic link) +
  invite flow · PWA scaffolding (manifest + serwist worker + placeholder
  icons; serwist deferred to Phase 8) · idempotent seed for three canonical
  dev users · Next 16 proxy rename · JWT-claim role decode · sign-out wired
  · landing / login / signup / invite surfaces rebuilt from Claude Design.
- **Migrations:** none.
- **Drift delta:** (not captured).
- **Manual QA:** (not captured).

---

## Phase 4 — Demo club CRUD — closed 2026-04-25

- **Branch tip:** `e60e85c` (`rebuild/phase-4-demo-club`)
- **Sub-checkpoints:** 4-prep (impersonation removed → v2; invite preset
  fallback to core-black; vitest single-pool; storage for `club-logos`;
  drift log seeded; Phase 12.5 added to plan) · 4a (`create_club_with_dependencies`
  RPC + storage + types regen + actions + RPC tests) · 4b (`/platform/clubs`
  list + detail tabs + Theme tab + tests + Playwright theme-flip smoke ·
  THEME_PRESETS extracted to satisfy client-module taint) · 4c (5-step
  new-club wizard + draft persistence + Playwright E2E) · 4c5/4c6 (Zod 4
  resolver bump · statement_timeout fix · invite-banner gate) · 4d
  (`/platform/districts` + `/platform/users`).
- **Migrations:** 014 `create_club_with_dependencies` · 015 `club-logos`
  bucket · 016 RPC statement_timeout fix.
- **Drift delta:** (not captured) → ~7 open (drift log seeded mid-prep).
- **Manual QA:** (not captured).

---

## Phase 4-design — Design integration — closed 2026-04-28

- **Branch tip:** `df7a384` (`rebuild/phase-4-design-integration`)
- **Sub-checkpoints:** AdminSidebar replaced with Claude Design treatment ·
  PageHeader redesign + log audit_log gap · 5 shared primitives extracted
  · WizardProgress upgrade · `/platform/clubs` list redesign + ClubsTable
  test refresh · new-club wizard chrome + success banner · wizard step
  bodies polish + Surface drift fix · `/platform/clubs/[id]` hero + tabs +
  overview redesign · `/platform/districts` + `/platform/users` redesign ·
  fix BSA-terminology slip in Step 3 copy · fix ClubsTable filter freeze
  (TanStack Table memo bug) · TopBar platform variant (tag pill + crumbs
  + bell + avatar) · align E2E selectors · authenticated Lighthouse
  helper (`/platform/clubs` desktop **99 / 96 / 100 / 91**).
- **Migrations:** none.
- **Drift delta:** (not captured).
- **Manual QA:** Lighthouse passed; E2E green; manual visual walkthrough
  by user before Phase 5.

---

## Phase 5 — Player onboarding — closed 2026-04-28

- **Branch tip:** `7672b22` (`rebuild/phase-5-player-onboarding`)
- **Sub-checkpoints:** 5a schema audit · 5b invites + members + bulk-invite
  modal · 5c shared `parsePlayerCsv` + `create_player_invites_batch` RPC ·
  5d `/me/setup` 4-step RHF + Zod 4 wizard + `(player)/(gated)` profile
  gate · 5e dual-club switcher + `/me` primary toggle + NoviceBadge in
  player TopBar + full onboarding E2E + bulk-invite E2E + skip-wizard E2E +
  RPC tests + layering audit (escalated 2 Phase-11 drift items as v1
  blockers).
- **Migrations:** 017 `invites.first_name + last_name` · 018
  `create_player_invites_batch` · 019 `complete_player_profile` · 020
  `set_primary_membership`.
- **Drift delta:** (not captured) → 2 escalations to v1-blocker.
- **Manual QA:** full onboarding E2E green; user walkthrough before
  Phase 6.

---

## Phase 6 — Tournament engine — closed 2026-04-28

- **Branch tip:** `f1862f7` (`rebuild/phase-6-tournament-engine`)
- **Sub-checkpoints:** 6a (file moves: completion merge + matchHelpers
  under `brackets/` · rounds + seeding primitives · BracketTree port ·
  drift entries for tournament batch RPCs + BSA seeding + §18 docs) · 6b
  (`lib/tournaments/formats.ts` per §9 · migration 022 bracket-tracking
  columns · `lib/tournaments/adapters.ts` + tests · enum-vocab drift
  closed) · 6c (`handicap.ts` gated on `ruleType === 'HANDICAP_START'` ·
  roundRobin + sectional skeletons · composite round-trip adapter test)
  · 6d (10 server-action scaffolds + Zod schemas + 33 test cases) · 6e
  (drift log for closeEntries-gate semantics · BracketTree restyled to
  Phase 1 tokens + speckle accent · `@vitest/coverage-v8` for the
  `lib/tournaments` coverage gate · targeted coverage tests for
  underweight primitives).
- **Migrations:** 021 tournament `seeding_method` · 022 match bracket
  columns (slot_a/b_source_type + slot_a/b_source_match_id).
- **Drift delta:** (not captured) → ~29 open by close (drift log
  enriched with Phase-7-UI-mirror items).
- **Manual QA:** test suite + coverage gate passed; user reviewed engine
  before Phase 7.

---

## Phase 7 — Tournament admin UI — closed 2026-04-29 (formal close after manual QA)

- **Branch tip:** `95cd810` (`rebuild/phase-7-tournament-admin-ui`,
  cut from `f1862f7`; PHASE_LOG bookkeeping commit `37afd03` lands on top
  of 7e, then 4 follow-up commits for manual-QA findings before formal close)
- **Sub-checkpoints:** 7-prep (cmdk + react-hotkeys-hook +
  `@react-pdf/renderer` deps · `AdminSidebar` dual-variant club_admin +
  super_admin · `EntriesGatePill` extract · `FormatPicker` 5-card grid
  with Triples first-class · `StructurePicker` 4-card with locked
  round_robin/sectional · splatter accent restored theme-driven) · 7a
  (`/manage/tournaments` Server Component + 8-col list + 3-col grid
  view + URL-state filters per Phase-4 pattern) · 7b
  (`/manage/tournaments/new` 4-section single-page form · TZ-aware
  `lib/format/dates.ts` extracted) · 7c-i (detail shell hero + sticky
  tabs + 5 stubs · EntriesTab virtualised TanStack table 9 columns) ·
  7c-ii (StatusDot + MatchCard + BracketCanvas + FinalizedToggle
  primitives · DrawTab + MatchModal · migration 023) · 7c-iii
  (BulkScoringGrid + action wrappers · ScoringTab round chips +
  progress + grid · migrations 024 + 025) · 7c-iv (RinkHeatmap ·
  RinksTab + CommsTab + AuditTab) · 7d (TournamentCommandPalette ⌘K
  · 3 PDF templates DrawSheet/RoundScoresheet/FinalResults via
  `@react-pdf/renderer` · `/payments` roadmap stub · React Compiler
  housekeeping in MatchModal/DrawTab/BulkScoringGrid) · 7e (full
  verification + 75 new tests + layering audit + Lighthouse +
  PHASE_LOG.md backfill).
- **Migrations:** 023 `save_round_fixtures_batch` · 024
  `bulk_save_match_scores_batch` · 025 `admin_finalize_matches_batch`
  (atomic batch with WINNER_OF_MATCH propagation across slot_a/b_source_match_id).
- **Drift delta:** 29 → 29 open / 11 → 11 closed (no net drift movement
  in 7e; 7d-prep added 1 entry — feeder match_no display via hash —
  before sub-phase work began).
- **Manual QA (7e close, 2026-04-28):** Lighthouse desktop on
  `/manage/tournaments/[id]`: **Performance 86 / Accessibility 100 /
  Best Practices 96 / SEO 91** (target ≥85 met). Suite at 418 tests
  passing (343 baseline + 75 Phase-7e additions). RLS suite 49/49 green
  against cloud. The Lighthouse score was later found to have been
  measured against a 404 page rather than the real detail surface — see
  `DRIFT_LOG.md` Phase 7 retrospective entry; Lighthouse re-run is queued.
- **Follow-up commits (2026-04-29 manual QA findings):** 4 commits land
  on top of `37afd03` before formal close.
  - `954938c` **host-club resolver** — Findings 1 + 3. Phase 7 admin
    layouts resolved the host club via `getCurrentMemberships()` which
    only queries `club_memberships`; club_admins live in
    `club_admin_assignments`. Result: admin@demo.local foot card
    duplicated the role label ("Club Admin / CLUB ADMIN") and
    `/manage/tournaments/new` redirected to the list because `primary`
    was null. New `lib/auth/admin-clubs.ts` + unified
    `getCurrentHostClub()` resolver in `lib/auth/memberships.ts` switching
    on JWT role. AdminSidebar contract preserved (club name on club_admin,
    user name on super_admin). +10 tests. +1 drift (Phase 13 hydration
    mismatch on TournamentsList junk URL params, logged but not fixed).
  - `5cd4375` **parseTabFromUrl client/server boundary** — surfaced after
    the host-club fix unblocked `/new`. Detail page Server Component
    imported `parseTabFromUrl` from a `"use client"` module; Next 16 wraps
    such imports as Client References, throwing
    "Attempted to call parseTabFromUrl() from the server" at SSR. Fix:
    extracted parser + `TabId` + `ALL_TAB_IDS` to a universal module
    `_components/tabs.ts` (no `"use client"`, no `"server-only"`). +5
    tests. `npm run build` did not catch the bug (dynamic route skipped
    during prerender) — documented in commit message as a known Next 16
    static-analysis gap.
  - `525ed3d` **detail-page 404 — embed query** — Finding 4. Form-submit
    redirect to `/manage/tournaments/[id]` 404'd; the parent embed
    `matches:matches(count, status)` translated to invalid SQL
    (Postgres 42803, "must appear in the GROUP BY clause"). Fix:
    dropped the broken embed, added a separate scoped
    `select status from matches` query, aggregate the three buckets in
    JS. Surfaced query errors to `console.error` so this class of bug
    can't silently 404 again. +8 tests. +3 drift (profile_id /
    auth.users.id audit + Lighthouse-on-404 retro + tournament_summary
    RPC consolidation for Phase 12). Diagnosis evidence captured via
    direct PostgREST replication; no migration, no cloud touch.
  - `95cd810` **command-palette z-index + splatter stacking + /payments
    public-route** — Findings 6 + 7 + 8 + 9. cmdk's `Command.Dialog`
    overlay-styling was on the wrong className target (inner Command
    instead of Dialog.Overlay/Content) — Radix portal dropped the panel
    at `z-auto`. Fix: explicit `fixed z-50` on overlay + content,
    matching `components/ui/dialog.tsx`. SplatterAccent's intrinsic
    `transform: rotate(...)` stacking context could leak above sibling
    content; fix: `isolate` on `TournamentHero` + `BracketCanvas`
    parents, plus a stacking-expectation block on `SplatterAccent.tsx`.
    `/payments` was missing from `isPublicPath()`, bouncing logged-in
    admins to `/manage/overview` and anon users to `/login`; fix: add
    to allow-list, delete vestigial empty `app/(public)/payments/`
    directory. +3 tests. No new drift (all Phase 7 bug fixes).
- **Manual QA (formal close, 2026-04-29):** User walked checklist Phase
  5 through Phase 9 (detail hero + 6 tabs + command palette + /payments).
  All pass. Phase 10 (theme regression across `data-theme` swaps)
  deferred — single seeded club means there's no second club to
  regression-test against; will run when `seed:dev:tournaments` lands
  in Phase 8 prep.
- **Test-suite trajectory:** 418 (7e) → 428 (host-club) → 433 (tab
  parser) → 441 (detail 404) → 444 (palette + payments). Final: 41
  files / 444 cases / 0 failures. RLS suite remained 49/49 throughout.
- **Drift delta (formal close):** 29 → 33 open / 11 → 11 closed across
  all of Phase 7 (29 carried in from 7d-prep + 7e bookkeeping; +1 from
  host-club commit, +3 from detail-404 commit; no closes — Phase 7
  follow-ups were bug fixes, not deferred-drift resolution).

---

## Phase 8 — Tournament player UI (mobile-first, offline-first) — closed 2026-04-29

- **Branch tip:** `4c42ca7` (`rebuild/phase-8-player-surfaces`, cut from
  `37afd03`). Phase 8 carved into eight sub-checkpoints (8-prep, 8a–8g)
  driven incrementally as user-greenlit chunks; sub-phases not pre-named
  in the rebuild plan.
- **Sub-checkpoints + headline SHAs:**
  - **8-prep** `e6cd30b` — player primitives + 5-tab bottom nav + /t20 stub.
  - **8a** `6f840ca` — `/play` home + `/me` profile + `/me/inbox` surfaces.
  - **8b** `ca8ef47` — `/tournaments` list + read-only player detail.
  - **8-seed** `4dda0a6` — dev tournament seeder + browser-QA convention.
  - **8c** `d177162` — scorecard surface (wake-lock + wet-hands + Dexie outbox).
  - **8d-prep** `9e5d909`–`66c6004` — migrations 026 (`submission_status` enum) + 027 (match_ends participant RW + `updated_at` trigger) + lifecycle action contracts.
  - **8d** `bd9c668`–`c358dfb` — outbox flush + Serwist runtime caching + scoring-grid design alignment + migration 028 (matches participant UPDATE + state-machine guard) + rinks-embed fix across three `_data.ts` sites.
  - **8d follow-ups** `c9be11d`–`527a89d` — Finding 13 (cache revalidation across player surfaces) + Finding 14 (migration 029 `matches.submitted_by_team_id` + passive-vs-active captain branching) + Finding 17 (overview queries hide captain_submitted matches) + types regen + drift retrospective.
  - **8e-prep** `05d7b1a` — migration 030 `cancel_own_booking` RPC + plan split (old Phase 9 → 8e player + 9 admin).
  - **8e-1 → 8e-3** `806ed78`, `a8f17ed`, `637f709` — `/book` shell + DateStrip + SlotList → BookingSheet + `createBooking` + GIST race handling → MyBookings shared component on `/book` (compact) + `/me` (full) + `cancelBooking` action.
  - **8e follow-ups** `3048543`, `0958e00` — Finding 18 seed gap (Demo Bowls Club greens + rinks) + degenerate-state UX (allRinksCount === 0 branch).
  - **8f-1 → 8f-3** `0940ea2`, `a4b2a50`, `2a837ee` — apple-touch-icon + manifest `id` → InstallPromptToast (Android `beforeinstallprompt` + iOS Safari fallback) → `scripts/lighthouse-pwa.mjs` runner across 5 player surfaces.
  - **8g** `fb65cae` (strip) + close commit — ConflictResolutionSheet stripped (real-world conflict frequency does not justify maintenance burden); plan PWA-gate realignment + drift triage applied + this PHASE_LOG entry.
- **Migrations applied:** 026 (`submission_status` enum) · 027 (`match_ends.updated_at` + participant RW policies + set_updated_at trigger) · 028 (matches participant UPDATE + state-machine guard) · 029 (`matches.submitted_by_team_id` + first-submission gate + freeze trigger) · 030 (`cancel_own_booking` SECURITY DEFINER RPC).
- **Drift delta:** 33 → 43 open / 11 → 17 closed. Phase 8 added the largest drift movement of any phase to date (Findings 1–18, several Phase 13 audit tasks, several Phase 12.5 polish tasks); Phase 8g triage closed 6 entries (134 batch RPCs already shipped, 156 RLS test teardown already wired, plus 4 carried-over closures across the phase).
- **Test-suite trajectory:** 444 (Phase 7 close) → 615 (Phase 8f-3 peak) → **610 (Phase 8 close, post-strip)**. 62 test files / 610 tests / 0 failures. RLS integration suite ships +9 cases for migrations 028/029/030 but is deferred-execution (Docker-up dependency).
- **PWA gate realignment.** The original plan's "Lighthouse PWA ≥ 95" gate is structurally unverifiable — Lighthouse 12+ removed the PWA category entirely. Replacement gates: real-device install per platform (Android Chrome `beforeinstallprompt` → standalone; iOS Safari Add to Home Screen → standalone), manifest validity, SW registration, offline shell loads. Performance gate (`/play` 62 / `/book` 77 / `/tournaments` 77 / `/me` 73 from Phase 8g production-build re-run) moved to Phase 12.5 final polish; primary suspect is a single 1.4MB chunk in `.next/static/chunks/`. Plan diff lands in this commit.
- **Manual QA verification:**
  - **Scenario 1 (book + cancel):** verified during Phase 8e walk; reset and re-walked after Finding 18 fix.
  - **Scenario 2 (offline path):** verified during Phase 8d walk — score offline, reconnect, outbox flushes.
  - **Scenario 3 (conflict resolution):** **obsolete by Phase 8g strip** — the conflict UI no longer exists; server-side LWW via migration 027 is the conflict story.
  - **Scenarios 4 + 5 (tap-to-retry, wake-lock + wet-hands):** deferred to user-walk-when-convenient (low-risk; underlying primitives are stable, unit-tested, and mostly behavior-on-real-device).
  - **Production-build Lighthouse:** scores recorded above; gate realignment closes the verification loop.
- **Operational conventions added during Phase 8** (recorded under "Operational conventions" below):
  - "Browser-driven QA is human-side throughout the rebuild" (post 8a).
  - "Bot-opponent matches confirm via admin verifyMatch override in dev QA" (8d).
  - "Autumn Singles Final · 21-14 win on /play is intentional seed data" (8d follow-up Finding 15).
- **Process artefacts logged for Phase 13 codification:**
  - **Two-commit rule for schema-dependent application changes** (drift entry post Finding 14): migration lands as its own atomic commit, pushed and verified on cloud, BEFORE any application code that depends on the new schema. Pattern applies to Phase 9 (admin booking schema), Phase 10 (T20), Phase 11 (Resend).
  - **State-machine-vs-surface audit** (drift entry post Finding 17): every state machine introduced by a migration must be checked against every consuming surface in the same phase. Phase 13 audit task: build a state×surface matrix.
  - **Server-only module poisoning risk audit** (drift entry post 8e-2): `_data.ts` modules with `import "server-only"` cannot export runtime values consumed by Client Components. Phase 13 audit + ESLint rule candidate.
- **Phase 9 readiness.** Schema for admin booking surfaces is fully in place (migrations 005, 006, 010 — booking_windows, bookings, GIST exclusion, RLS policies). Plan section "12. Phase 9 — Admin booking surfaces" carved out from old Phase 9 during 8e-prep. Likely needs an `admin_force_cancel_booking(uuid, reason text)` RPC parallel to `cancel_own_booking` for audit-trail semantics — audit-table decision deferred to that phase.

---

## Phase 9 — Admin booking surfaces — closed 2026-04-29

- **Branch tip:** `b41e814` (`rebuild/phase-9-admin-booking`, cut from
  `4c42ca7` Phase 8 close). Phase 9 carved into four sub-checkpoints
  driven incrementally — 9-prep / 9-1 / 9-2 / 9-3 — none pre-named in
  the rebuild plan; the carve mirrored Phase 8's incremental sub-phase
  pattern.
- **Sub-checkpoints + headline SHAs:**
  - **9-prep** `6212098` — migration 031: generic `audit_log` table
    (table_name + row_id + action + reason + payload + performed_by +
    performed_at) + `audit_log_visible_to_admin(text, uuid)` SECURITY
    DEFINER helper (currently dispatches on `table_name='bookings'`,
    extends per-table via `elsif` branches as future audited paths
    land) + `admin_force_cancel_booking(uuid, text)` RPC writing the
    cancel + audit row in one transaction. Decision recorded:
    skip a `admin_force_book` RPC — admins use the existing
    `bookings_club_admin_rw` INSERT permission; force-cancel + re-book
    = two audit rows = clean trail. Single-RPC override that bypassed
    GIST would have been a footgun.
  - **9-1** `f8c10e3` — `/manage/greens` weekly availability editor
    (`WeeklyAvailabilityEditor` 7-col × 16-row grid against
    `booking_windows`; click-drag bulk-toggle + snapshot-replace save
    via `replaceWeeklyClosures` action — preserves one-off date-range
    closures via weekday-only DELETE) + per-rink disable toggle
    (`RinkDisableToggle` with required maintenance-reason form when
    flipping active=false; reason stored in success-toast for now,
    `audit_log` plumbing for table_name='rinks' deferred to Phase 12.5).
  - **9-2** `4e7fed6` — `/manage/overview` Bookings tab. Replaces the
    Phase 4 stub with `BookingsCalendarGrid` (7 SAST days × 16 hours,
    chip-per-booking with rink/purpose/booker, today-column highlight,
    week-nav `?w=YYYY-MM-DD`) + `BookingDetailSheet` (vaul-portaled
    BottomSheet showing booking metadata + force-cancel form when
    status='booked'; "already cancelled" notice otherwise) +
    `adminForceCancelBooking` server action (Zod-gated booking_id +
    reason 1-500 chars, distinguishes too_small (`reason_required`) vs
    too_big (`validation`), maps every SQLSTATE branch to a typed
    result kind, revalidates `/manage/overview` + `/book` + `/me`).
    Pure SAST date helpers (`week.ts`) live without the `'server-only'`
    directive — same poisoning-risk pattern Phase 8e-2 codified for
    `slots.ts`, since `BookingsCalendarGrid` (Client) imports them at
    runtime.
  - **9-3** `b41e814` — `AuditLogPanel` server-rendered list of
    recent audit-log rows scoped to the host club. Sits below the
    bookings calendar so a force-cancel appears in the trail without
    leaving the page. Data fetcher `getRecentAuditLogForClub` uses a
    bounded two-step (recent 500 booking IDs of the host club → audit
    rows IN those IDs) to scope multi-club admins to the currently-
    viewed club. RLS via `audit_log_visible_to_admin` is the
    authorisation; the explicit filter just narrows display.
- **Migrations applied:** 031 (`audit_log` + `audit_log_visible_to_admin`
  helper + `admin_force_cancel_booking` RPC). One migration this phase;
  Phase 8e's migrations 026/027/028/029/030 covered the booking and
  scoring schema needs.
- **Drift delta:** 43 → 44 open / 17 → 19 closed (closed: Phase 9
  admin-surfaces parent entry; closed: Phase 8d-followup migration-029
  RLS Docker-deferred entry, closed during 9-prep when Docker came up;
  added Phase 9-3: tournament-AuditTab retrofit, audit-fetcher 500-row
  pre-fetch cap, audit-fetch-error telemetry; the 9-1 / 9-2 commits
  had no drift movement — both shipped at scope).
- **Test-suite trajectory:** 610 (Phase 8 close) → 729 (9-2) → **743**
  (9-3 close). 71 test files / 743 cases / 0 failures. RLS suite
  trajectory: 49 (Phase 7) → 70 (9-prep, Docker-up first run) →
  77 (9-2) → **85** (9-3 close). 12 RLS files / 85 cases / 0 failures.
- **Verification gates at close:** `npm run typecheck` clean; `npm run
  lint` 0 errors / 16 pre-existing warnings (none in Phase 9 code);
  `npm run test` 743 passed; `npm run test:integration` 85 passed;
  `npm run build` clean; branding grep returns zero.
- **Manual QA verification:** deferred to user's manual walk per the
  Phase 8 operational convention ("Browser-driven QA is human-side
  throughout the rebuild"). Surfaces to walk: `/manage/greens` weekly
  editor + rink toggle (9-1); `/manage/overview` calendar + force-
  cancel sheet + audit panel (9-2/9-3). Force-cancel flow covers the
  full audit trail end-to-end (cancel → audit row → panel render).
- **Operational decisions recorded during Phase 9:**
  - **Generic `audit_log` over per-table tables.** 031 design note
    captures the rationale: every audited action has the same shape
    (table_name + row_id + action + reason + payload + performed_by +
    performed_at), so per-table audit tables would multiply schema
    surface for no benefit. Future audited paths plug in by writing
    the same INSERT shape from their own SECURITY DEFINER RPCs and
    extending the visibility helper's `elsif` ladder.
  - **`admin_force_book` skipped, force-cancel + re-book preferred.**
    Recorded in 9-prep migration 031 design notes: a single-RPC override
    that bypassed the bookings GIST exclusion would be a footgun (and
    audit-asymmetric — the original cancel and the new booking would
    look unrelated). Force-cancel + re-book = two audit rows on
    different bookings = clean, traceable trail. Admins use the
    existing `bookings_club_admin_rw` INSERT policy for the re-book.
  - **Audit panel scope = current host club, not all clubs the admin
    administers.** Multi-club admins (rare today) see only the host
    club's audit rows in the panel because the data fetcher pre-filters
    by `bookings.club_id = clubId`. The RLS policy alone would expose
    every club's audit rows the admin can see. Explicit filter matches
    the page's "you're managing club X" framing.
- **Phase 10 readiness.** T20 schema (migrations 007 `t20_assessments`
  + `t20_deliveries` + `t20_section_aggregates`; migration 013 rubric
  v1) already applies to the working DB. Plan section "13. Phase 10
  — T20 assessment module" specifies migration 016 as a Phase 10 step
  (`t20_distance_bucket` column), the v1-final-2026 rubric JSON, the
  CompassPicker component contract, and the `/manage/t20` admin
  surface tree. No outstanding precondition work.

> **Corrective addendum (Phase 10 close, 2026-04-29):** the line above
> referencing `t20_section_aggregates` (in the schema gloss) is wrong
> — there is no `t20_section_aggregates` table in migrations 007 / 013.
> Per-section subtotals are computed at runtime from `t20_deliveries`
> via `aggregateAssessment` in `lib/t20/score.ts`. Append-only
> convention preserves the original line; this addendum is the
> correction.

---

## Phase 10 — Twenty 20 assessment module (production rubric) — closed 2026-04-29

- **Branch tip:** `ce6f548` (`rebuild/phase-10-twenty20`, cut from
  `b41e814` Phase 9 close). Phase 10 carved into nine sub-checkpoints
  driven incrementally — 10-prep / 10-1 / 10-2 / 10-3 (six commits) /
  10-4 / 10-5 / 10-6 / 10-7 / 10-8 / 10-close.
- **Naming convention locked:** "Twenty 20" (with space) is canonical
  UI / copy spelling — page headings, button labels, breadcrumbs,
  email subjects, navigation labels, PDF titles, all user-visible
  strings. `t20_*` is internal code shorthand only — table names,
  enums, column names, file paths, route segments, TypeScript
  identifiers, comments. The `bsa-terminology` skill was updated at
  `~/.claude/skills/bsa-terminology/SKILL.md` to codify this split
  (filesystem only — not in repo).
- **Sub-checkpoints + headline SHAs:**
  - **10-prep** `4fd2bbf` — migration 032: `t20_distance_bucket text`
    column on `t20_deliveries` with CHECK `('<10cm','10-30cm','30cm+')`
    or NULL + partial index on non-null. Backwards-compatible with v1
    (existing rows keep distance_bucket=NULL; grading unchanged).
    Pushed to cloud via `supabase db push --linked` at the start of
    10-3 (commit `b089978` cloud-anchored types regen).
  - **10-1** `c37cb9e` — scoring engine. `lib/t20/rubric.ts` (Zod
    `RubricSchema` validating uploaded rubric JSON against the seeded
    v1-final-2026 shape; section/zone/grade type exports;
    `SECTION_KEYS` / `ZONE_IDS` / `ZONE_META` constants) +
    `lib/t20/score.ts` (`scoreDelivery` / `sectionMaxes` / `grandMax`
    / `gradeFor` / `aggregateAssessment`). 37 unit tests covering
    every section model + plan-locked grading edges (79.9% silver,
    80.0% gold, 49.9% fail, 50.0% bronze, etc.).
  - **10-2** `ccaba80` (lint follow-up `5b6e5d0`) — data layer +
    9 server actions. `_data.ts` ships `getActiveRubric`,
    `listAssessmentsForClub`, `getAssessmentDetail`,
    `getT20CandidatesForClub`. `_actions.ts` ships
    `createAssessment`, `startCapture`, `recordDelivery`,
    `completeRound`, `finalizeAssessment`, `addSecondMarker`,
    `createAssessmentFromForm` (form-data wrapper for
    `useActionState`). `platform/rubrics/_actions.ts` ships
    `uploadRubricVersion`, `activateRubricVersion`,
    `deactivateRubricVersion`. All Phase 9-style: Zod gating + typed
    Result discriminated unions + `revalidatePath`.
  - **10-3** (six commits, `407923d` → `9d803b0`) — eight shared
    components in `components/t20/` extracted from the design
    bundle's `t20-components.jsx`. Each ships its own test file:
    `GradePill` (sm/md/lg, ★ sigil on lg gold) · `AssessmentCard`
    (state-branched list-row card) · `SectionStepper` (7×2 grid for
    capture wizard) · `CompassPicker` + `CompassHeatmap` (iconic SVG
    rose, geometry verbatim from design) · `HandBalanceChart` /
    `LengthDistributionChart` (pure-CSS, no recharts dep) ·
    `RubricDiff` (unified-diff with sigil + tinted rows). 79 cases
    total. Shipped via 6 atomic commits per surface.
  - **10-4** `05282a3` — `/manage/t20` assessments list. Server
    Component composes hero + 4 stat cards + active-rubric pill;
    Client island (`AssessmentsListClient`) handles search /
    status / grade filter chips + card grid + 2 empty states
    (no-data / no-match). 21 cases.
  - **10-5** `2f0e4cf` — `/manage/t20/new` setup form. 5-section
    layout (Player picker + history sidebar / Assessor card-grid +
    accreditation input / Conditions / Rubric reference card with
    "View details" modal showing 7-section table / Second-marker
    toggle). Wired via `useActionState` + `createAssessmentFromForm`
    → `redirect()` to capture wizard on success. 25 cases.
  - **10-6** `a7e6272` — `/manage/t20/[id]/capture` wizard. The
    high-stakes UX. Three section bodies branched on rubric model:
    LineOutcomeBody (S1-2 distance tabs + 8 delivery cards) /
    ZonesBody (S3-5 CompassPicker + hand toggle + 8 bowl thumbs) /
    OnLengthBody (S6-7 4 ladder cards × F+B rows). Wake-lock
    acquired on first `onPointerDown` via existing Phase 8c
    `lib/scorecard/use-wake-lock.ts` hook. New `SaveIndicator`
    primitive (3 states: saved / saving / failed). Resume via
    `hydrateAndSeek` walking SECTION_KEYS×[1,2] for next incomplete
    (section, round). 28 cases.
  - **10-7** `930c9fd` — `/manage/t20/[id]` results view. Server
    Component pre-computes server-side aggregations: `score`
    (re-derived via `aggregateAssessment`), `zoneCounts` (drive +
    control + trail combined), `handBalance`, `lengthDistribution`.
    Six composed sections: ResultsHero (grade-reveal moment with
    GradePill lg, 500ms animated reveal, per-grade gradient) /
    SectionBreakdown (animated progress bars cascading 80ms per row)
    / ChartsRow (CompassHeatmap + HandBalanceChart +
    LengthDistributionChart) / NotesSection / SecondMarkerSection
    (inline form wired to `addSecondMarker`) / back-link.
    `requestPdfExport` placeholder action returns kind='pending'.
    27 cases.
  - **10-8** `3eec10d` — `/platform/rubrics` super-admin rubric
    library. Six composed sections: Hero / UploadZone (drag-drop +
    client-side `RubricSchema.safeParse` + server-side action) /
    DraftBanner (amber-tinted when draft exists) / VersionsTable
    (status pills active / draft / archived mapped from
    `is_active` boolean + assessment-count) / PendingChangesPanel
    (permanent inline `RubricDiff` between active + first draft) /
    3 modals (Diff / Activate with acknowledge checkbox /
    Deactivate). New helper `lib/t20/diff.ts` —
    `diffRubrics(active, incoming)` returns domain-aware
    `RubricChange[]` covering grading bands + passPctTarget +
    assessor + per-section model/distances/points/zonePoints/
    pointsPerOnLength. 40 cases (13 diff + 27 client).
  - **10-close** `ce6f548` — PHASE_LOG entry + DRIFT_LOG
    sweep + Phase 9 corrective addendum.
- **Migrations applied:** 032 (`t20_distance_bucket text` column +
  CHECK + partial index). One migration this phase; the rest of the
  schema (`t20_assessments`, `t20_deliveries`, `t20_rubric_versions`)
  was seeded in Phase 2 migrations 007 + 013. Cloud + local in sync
  (verified via `supabase migration list --linked` at 10-3 start).
- **Components extracted:** 9 net-new under `components/t20/` —
  `GradePill`, `AssessmentCard`, `SectionStepper`, `CompassPicker`,
  `CompassHeatmap`, `HandBalanceChart`, `LengthDistributionChart`,
  `RubricDiff`, `SaveIndicator`. All consume design-system tokens
  (`--primary-500`, `--ink`, `--bone`, `--speckle-a`/`--speckle-b`,
  `--border`/`--border-strong`, `--on-primary`); no new tokens
  introduced.
- **Surfaces shipped:** 5 pages — `/manage/t20` (list) ·
  `/manage/t20/new` (setup form) · `/manage/t20/[id]/capture`
  (wizard) · `/manage/t20/[id]` (results) · `/platform/rubrics`
  (super-admin library).
- **Server actions wired:** 9 from the brief —
  `createAssessment`, `startCapture`, `recordDelivery`,
  `completeRound`, `finalizeAssessment`, `addSecondMarker`,
  `uploadRubricVersion`, `activateRubricVersion`,
  `deactivateRubricVersion`. Plus 1 placeholder
  (`requestPdfExport` kind='pending' until template ships) and
  1 form-data adapter (`createAssessmentFromForm` for
  `useActionState` on the New form).
- **Drift delta:** 44 → 60 open / 19 closed unchanged. Across the
  whole phase: +2 from 10-2 (addSecondMarker composite column +
  `activateRubricVersion` sequential UPDATE) already in the log
  before 10-close; +14 added at 10-close (capability gaps from 10-4
  through 10-8 logged individually for follow-up ownership). No
  closures — Phase 10 had no parent deferral entry to roll up
  (the Phase 2 schema 007 + 013 was the implicit carry).
- **Test-suite trajectory:** 743 (Phase 9 close) → 780 (10-1) →
  780 (10-2) → 859 (10-3) → 880 (10-4) → 905 (10-5) → 933 (10-6) →
  960 (10-7) → **1000 (10-8 + 10-close)** ✨ thousand-test milestone
  reached at 10-8. 85 test files / 1000 cases / 0 failures. RLS
  integration suite remained 85/85 across the phase (no Phase 10
  RLS coverage added — the action-layer Zod gating + `getAuthContext`
  + super-admin role check + the existing migration 010 RLS policies
  on `t20_assessments` / `t20_deliveries` / `t20_rubric_versions`
  serve as the authorization story; explicit RPC coverage like
  Phase 9's audit_log is unnecessary because no SECURITY DEFINER
  RPCs ship in Phase 10).
- **Verification gates at close:** `npm run typecheck` clean;
  `npm run lint` 0 errors / 18 pre-existing warnings (none in
  Phase 10 code at close); `npm run test` 1000 / 1000 passed;
  `npm run test:integration` 85 / 85 passed; `npm run build`
  clean — all 5 Twenty 20 routes ƒ-routed; branding grep
  (`henselite|choice of champions`) returns 0 hits across
  `app components lib public`; `T20` user-visible-string grep
  returns 0 hits (code-shorthand convention preserved).
- **Manual QA verification:** deferred to user's manual walk per
  the Phase 8 operational convention. Surfaces to walk: the entire
  /manage/t20 tree (list + new + capture + results) on a real
  browser — capture especially needs tablet validation as the
  high-stakes UX. /platform/rubrics needs a super-admin walk
  through upload + diff + activate + deactivate flows.
- **Operational decisions recorded during Phase 10:**
  - **"Twenty 20" UI / `t20_` code split.** Codified in
    `bsa-terminology` skill. Table names + file paths + URL
    segments + identifiers stay `t20_*` (grep + nav stay fast);
    every user-visible string uses "Twenty 20" with a space.
  - **"Reassess" vs "Fail" label distinction** (10-4 clarification).
    `t20_grade` enum + `Grade` type + `gradeFor()` return value
    stay `'fail'`. The user-visible result label on `GradePill`
    renders **"Reassess"** (coaching tone, per design source's
    `gradeMeta.fail.label`). The rubric-reference legend on the
    New form's Section 4 + the Activate modal's threshold display
    use **"Fail"** (documentary BSA vocabulary). Both spellings
    coexist intentionally — different roles on different surfaces.
  - **Online-only capture per plan §13.** No Dexie outbox for
    Twenty 20 captures; failed `recordDelivery` returns surface
    via `SaveIndicator state='failed'` and the coach retries by
    re-tapping (UPSERT path in the action). Rationale: assessments
    happen at the club with Wi-Fi; offline complexity isn't worth
    the carrying cost.
  - **Activation is one-way.** Existing assessments retain pinned
    `rubric_version_id` forever (FK `on delete restrict` per
    migration 007). Activate modal headline emphasises this with
    a required acknowledge checkbox. Deactivate UI gate prevents
    sole-active rubric deactivation; full deactivation flow
    surfaces only when ≥1 other version exists.
- **Phase 11 readiness.** Plan section "14. Phase 11 — Comms"
  scope is email + in-app notifications via Resend (Q6-locked: no
  SMS, no WhatsApp). Schema for `messages` ships in Phase 2
  migration 008 + RLS in 010. Outstanding v1-blocker drift items
  (`acceptInviteAction` + JWT club_ids stale-claim from Phase
  5e) are explicitly owned by Phase 11. No new Phase 10 work
  blocks Phase 11.

---

## Phase 11 — Comms (in-app messaging + system-triggered InviteEmail) — closed 2026-04-30

- **Branch tip:** `d2190b4` (`rebuild/phase-11-comms`, cut from
  `0c49a48` Phase 10 follow-up tip — the Twenty 20 manual-QA
  branding sweep). Phase 11 carved into seven sub-checkpoints
  driven incrementally over a single working day —
  11-prep / 11-1 / 11-2 / 11-3 / 11-4 / 11-5 / 11-6 / 11-close.
  22 atomic commits across the phase (excluding this close
  commit).
- **Scope revision mid-phase.** Plan §14 framed the scope as
  "email + in-app broadcasts" with five Resend templates
  (InviteEmail, TournamentAnnouncement, MatchReminder,
  BookingReminder, GenericBroadcast), a fan-out edge function,
  Resend webhook handler, and per-club daily broadcast cap.
  After 11-prep landed the user revised the scope: clubs handle
  their own member email externally; HandiBowls v1 ships in-app
  broadcasts only and a single system-triggered email template
  (InviteEmail). Four templates dropped, webhook handler
  dropped, daily-cap column kept but unused. Rationale captured
  inline in the 11-1 brief; the migration 033 column comment
  was updated in migration 034 to reflect the v1-unused state
  (handibowls-standards: never edit a prod-applied migration —
  write a new one).
- **Sub-checkpoints + headline SHAs:**
  - **11-prep** (3 commits, `8541718` → `2a09594`) — foundation.
    Migration 033 (`clubs.daily_broadcast_cap int not null
    default 2` + non-negative CHECK), `npm run types:gen`,
    `npm i resend @react-email/components @react-email/render`,
    `.env.example` documenting `RESEND_API_KEY`, `RESEND_FROM`,
    `EMAIL_UNSUBSCRIBE_SIGNING_SECRET`, `RESEND_WEBHOOK_SECRET`.
    Two-commit rule honoured (migration → push → verify → commit
    1, types regen → commit 2, deps → commit 3).
  - **11-1** (4 commits, `a0ecd68` → `ae7e81a`) — Resend
    foundation + InviteEmail + unsubscribe path. Migration 034
    (`clubs.daily_broadcast_cap` comment update noting v1-unused
    state). `lib/email/{client,render,unsubscribe}.ts` + shared
    `_BaseLayout` (POPIA footer with mandatory sender + speckle
    accent + theme-tracked header strip; Web Crypto HMAC
    unsubscribe tokens with 30-day TTL). `InviteEmail` template
    + golden-HTML snapshot test (6,437 bytes pinned).
    `app/(public)/email/unsubscribe` Server Component + Server
    Action `unsubscribeFromEmails` flipping
    `profiles.email_opt_in` via service-role.
  - **11-2** (3 commits, `1f9133e` → `1b5647f`) — `send_message`
    RPC for in-app fan-out. Migration 035 — SECURITY DEFINER
    `public.send_message(p_message_id uuid)` that resolves
    audience kinds (all_members / tournament_entrants / custom)
    and writes one `message_recipients` row + one `notifications`
    row per profile, then transitions `messages.status` from
    queued → sent (or failed on validation error). Atomic
    transaction; idempotent on terminal states. RPC chosen over
    Deno Edge Function — without Resend in scope, an HTTP runtime
    adds cold-start tax without giving anything back. Mirrors the
    Phase 9 `cancel_own_booking` pattern. TS wrapper at
    `lib/messages/actions.ts` + 7 RLS-mode integration cases
    proving fan-out shapes against the local Supabase stack.
  - **11-3** (3 commits, `557ae10` → `d3f84bb`) — admin
    `/manage/messages` list + compose. Replaces the Phase 3
    StubPage. Five-section compose form (subject / body /
    audience / schedule / channel) with helper-text-on-disabled-
    submit (Phase 10 manual-QA learning applied from the start),
    hard-coded in-app-only channel pill, save-as-draft / send-
    now / schedule-for-later actions. Audience picker covers all
    three kinds: all_members, tournament_entrants (dropdown
    sourced from club's tournaments), custom (searchable
    multi-select with name/email/BSA# search). `_form-state.ts`
    extracted from the start to dodge the bundler-boundary trap
    (Phase 10 fix `cd6d068` precedent).
  - **11-4** (5 commits, `5e7ef8c` → `ea3147c`) — InviteEmail
    wire-up + DRIFT 160/161/162 closures. Three v1-blocker
    drifts retired in lockstep:
    - **DRIFT 160** (Dev-only invite banner) — `lib/invites/email.ts`
      shared `sendInviteEmail` helper wires all three invite-
      creation paths (`createInvite`, `createPlayerInvitesBatch`,
      `createClub`) to render + send via Resend. Toast surfacing
      of `email_status` replaces the sessionStorage stash.
      `DevInviteBanner.tsx` + `DevInviteBanner.test.tsx` +
      `lib/dev-banner.ts` deleted; mounts in `clubs/[id]/page.tsx`
      + `manage/members/page.tsx` removed; zero residual
      references confirmed via grep.
    - **DRIFT 161** (`acceptInviteAction` returning-user) +
      **DRIFT 162** (JWT club_ids stale claim) — closed together
      because both touch the same function. `acceptInviteAction`
      splits into `acceptForExistingUser` (profile lookup by
      email; idempotent membership / admin-assignment insert;
      invite revoke; `audit_log` row; server-side `signOut()` +
      redirect to `/login?invited_to=<club>&next=<role-home>`)
      and `acceptForNewUser` (original happy path + audit row).
      Server-side `signOut()` chosen over client-side
      `auth.refreshSession()` — full re-auth fires the
      `custom_access_token_hook` against the post-membership
      state; refresh-token round-trip mints a new access token
      but its cached `app_metadata` is from the original
      session's user query. Login page reads `?invited_to=` and
      surfaces a confirmation banner so re-auth feels
      intentional. Pinned by `tests/integration/auth/accept-
      invite-{existing,new}-user.test.ts` (4 cases).
  - **11-5** (3 commits, `a5de843` → `83d75c4`) — realtime bell +
    inbox tap-to-mark-read. `useNotificationsRealtime` hook
    subscribes to `notifications:profile_id=eq.<id>` Supabase
    Realtime channel; `postgres_changes` INSERT/UPDATE handlers
    adjust unreadCount + recent dropdown. Optimistic
    `markAsRead` with rollback on server-side failure.
    `NotificationsBell` Client component mounts in player +
    club-admin TopBar `right` slots (super-admin layout
    deliberately skipped — super-admins don't receive
    broadcasts). Inbox `/me/inbox` lists extracted to Client
    island for tap-to-mark-read with `useTransition`-driven
    optimistic UI; closes the long-standing TODO from
    Phase 8a's inbox _data.ts.
  - **11-6** (1 commit, `d2190b4`) — compliance sweep + POPIA
    opt-out gate. `sendInviteEmail` now reads `email_opt_in`
    alongside the profile-by-email lookup; existing profile
    with `email_opt_in=false` returns `{ status: "skipped",
    reason: "opted_out" }` without rendering or sending.
    Three-branch toast (sent / skipped / failed) in
    `InvitePlayerModal` + `NewClubWizard`. POPIA audit
    documented every line item with file:line evidence.
    SMS bundle gate (strict, file-extension scoped) returns 0
    hits across `app/components/lib/supabase/scripts`. 6 new
    Phase 12 follow-up DRIFT entries documented (player-side
    /t20 build, resend invite button, live recipient-count
    preview, draft edit page, scheduled-send dispatcher,
    PlayerBottomNav "20/20" exception note).
  - **11-close** (this commit) — PHASE_LOG entry + DRIFT_LOG
    sweep + README status block update.
- **Migrations applied:** 3 — 033 (`clubs.daily_broadcast_cap`),
  034 (column comment update reflecting v1-unused state — the
  cap stays in schema for a future phase that re-introduces
  admin email broadcasts), 035 (`send_message` SECURITY DEFINER
  RPC for in-app fan-out). Cloud + local in sync (verified via
  Supabase MCP `list_migrations` after each push).
- **Surfaces shipped:**
  - `/manage/messages` (admin list page, replaces StubPage —
    status filter chips, subject search, empty states)
  - `/manage/messages/new` (admin compose, 5-section form with
    full audience picker)
  - `/me/inbox` upgrades — tap-to-mark-read on both notifications
    and message_recipients rows, optimistic UI
  - Top-bar `<NotificationsBell />` on player + club-admin
    layouts — Lucide Bell + numeric badge (caps at "99+") +
    dropdown with last 5 notifications + tap-to-navigate
  - `app/(public)/email/unsubscribe` (POPIA-compliant unsub
    page, public-no-auth — HMAC IS the auth)
  - `InviteEmail` template (production — actual sends pending
    operator-side Resend domain verification)
- **Server actions wired:** 13 — `unsubscribeFromEmails`
  (11-1c) · `sendMessage` (11-2 wrapper around
  `send_message` RPC) · `createMessageDraft`,
  `updateMessageDraft`, `sendMessageNow`, `scheduleMessage`,
  `deleteMessageDraft`, `composeMessageFromForm` (11-3) ·
  `markNotificationRead`, `markMessageRecipientRead` (11-5).
  Plus rewrites of `acceptInviteAction`, `createInvite`,
  `createPlayerInvitesBatch`, `createClub` to thread
  `email_status` through the result shapes.
- **Plan deviations from §14 — captured for the audit trail:**
  - Email broadcast channel **dropped**. Plan called for an
    optional in_app + email channel toggle in compose; revised
    plan locked admin compose to in-app only. Clubs handle
    their own member email externally via existing tools (own
    SMTP / mailing lists / WhatsApp groups). Reasoning: scope
    reduction to ship the Phase 11 essentials inside one
    working day; admin email is a stakeholder-polish concern.
  - **Four of five Resend templates dropped.**
    `TournamentAnnouncement`, `MatchReminder`, `BookingReminder`,
    `GenericBroadcast` would have been useful but each requires
    a triggering surface (compose UI + scheduler / event
    listener). Scope-reducing them out lets the InviteEmail —
    the only template with a clear v1 trigger surface
    (`createInvite`) — ship cleanly with all the foundation
    code (`_BaseLayout`, render helper, HMAC unsubscribe) intact
    for a future phase to re-add the remaining four.
  - **Resend webhook handler dropped.** `email_status`
    transitions from sent → delivered/bounced/complained were
    going to update `message_recipients`, but with admin
    broadcasts in-app-only and the only outbound being a
    one-shot transactional invite, the value of webhook-side
    delivery telemetry is marginal in v1.
  - **Daily broadcast cap column kept but unused.** Migration
    033 added `clubs.daily_broadcast_cap int not null default 2`
    with non-negative CHECK; migration 034 updated the column
    comment to note the v1-unused state. The cap policy is
    correct as written — when a future phase re-introduces an
    admin email channel, the SECURITY DEFINER `send_message`
    RPC reads this column at that time.
- **v1-blocker drift retirements (3):**
  - DRIFT 160 — Dev-only invite banner → closed by `5e7ef8c`
    (sendInviteEmail wiring) + `a7965af` (DevInviteBanner
    deletion).
  - DRIFT 161 — `acceptInviteAction` returning-user path →
    closed by `1b9d470`.
  - DRIFT 162 — JWT `club_ids` stale claim → closed by
    `1b9d470` (server-side `signOut()` + redirect pattern).
- **Phase 12 follow-ups documented (6):** Player-side `/t20`
  page never built (stub still in place; design exists from
  earlier player pass) · Resend invite button missing in admin
  UI (no "resend on failure" affordance) · Live recipient-
  count preview missing on `/manage/messages/new`
  (`resolveAudienceCount` exists, not called) · No edit page
  for existing message drafts (server foundation in place) ·
  Scheduled-send dispatcher not built (`scheduled_at` persists
  but no worker fires) · PlayerBottomNav "20/20" compact-form
  exception (documentation; bsa-terminology skill codified).
- **Drift delta:** 60 → 63 open / 19 → 22 closed. Three
  v1-blockers retired (160 / 161 / 162); six Phase 12 follow-
  ups added in 11-6.
- **Test-suite trajectory:** 1004 (Phase 10 close after
  branding sweep) → 1004 (11-prep, no test changes) → 1004
  (11-1a, foundation tests included in commit) → ... → 1162
  (11-5 close) → **1163 (11-6 + 11-close)**. RLS / RPC
  integration suite: 85 (Phase 10 close) → 92 (11-2 added 7
  send_message fan-out cases) → **96 (11-4 added 4
  acceptInviteAction integration cases)**. 98 unit test files
  / 1163 cases / 0 failures · 15 integration test files /
  96 cases / 0 failures.
- **Verification gates at close:** `npx tsc --noEmit` clean ·
  `npm run lint` 0 errors / 18 pre-existing warnings (zero
  new in Phase 11 code) · `npm test` 1163 / 1163 passed ·
  `npm run test:integration` 96 / 96 passed · `npm run build`
  clean — all new comms routes ƒ-routed (`/manage/messages`,
  `/manage/messages/new`, `/email/unsubscribe`,
  `/api/email/webhook` placeholder NOT in build since handler
  was dropped) · branding grep (`henselite|choice of
  champions`) returns 0 hits · T20 user-visible-string grep
  returns 0 hits (code-shorthand convention preserved) · SMS
  bundle gate (strict, TS/TSX/SQL/MJS scoped) returns 0 hits
  across app/components/lib/supabase/scripts.
  `supabase/config.toml` matches the wide grep at six lines —
  benign Supabase CLI scaffold defaults with `enabled = false`
  everywhere, never reaches the application bundle. Documented
  in 11-6 commit body.
- **Manual QA verification:** user confirmed all Phase 11
  surfaces walked + the bell-update perf check (plan §14
  success criterion "bell updates within 1s") confirmed prior
  to 11-close greenlight. Cloud Supabase Realtime publication
  for the `notifications` table verified during the manual
  pass.
- **Operational decisions recorded during Phase 11:**
  - **In-app first, email transactional only (v1).** Admin
    broadcasts ship via the `send_message` RPC's atomic in-app
    fan-out into `message_recipients` + `notifications`. The
    only outbound email path is `InviteEmail`, fired
    synchronously inside `createInvite` /
    `createPlayerInvitesBatch` / `createClub`. No fan-out
    worker, no Resend webhook telemetry, no batched email
    sends in v1.
  - **POPIA opt-out at the fan-out boundary, not the message
    fan-out.** Admin in-app messages bypass the email-channel
    `email_opt_in` filter because they don't email. The
    `InviteEmail` send path checks `profiles.email_opt_in` for
    existing recipients and skips the send (returning
    `status='skipped'`, reason `'opted_out'`) when the flag is
    false; the invite row still persists so the admin can
    copy/share the URL manually. New recipients (no profile
    yet) bypass the gate — POPIA's opt-out applies to existing
    profiles, not pre-relationship invitations.
  - **Server-side `signOut()` over client-side
    `refreshSession()` for new-club JWT rotation.** When an
    existing user accepts a second invite, we forcibly
    re-auth them (sign out + redirect to `/login?invited_to=`)
    so the `custom_access_token_hook` runs against the
    post-membership state. Refresh-token round-trip mints a
    new access token but caches `app_metadata` from the
    original session's user query. Net cost is one re-auth
    dialog; net gain is a guaranteed-correct token for every
    subsequent request. DRIFT 162 closure.
  - **DevInviteBanner pattern fully retired.** sessionStorage
    stash + 60-min TTL + custom-event re-read are gone. Toast
    surfacing of `email_status` covers the "did the email
    actually go?" UX without persisting credentials in
    client-side storage.
  - **PlayerBottomNav "20/20" compact-form exception.** Tab-
    width constraint (76px on a 5-tab bottom nav) makes
    canonical "Twenty 20" overflow. Compact "20/20" is the
    sole sanctioned exception to the locked spelling rule;
    annotated inline + pinned by test + codified in the
    bsa-terminology skill.
- **Operator-side prerequisites for production deployment:**
  - **Resend domain verification.** `handibowls.co.za`
    (or whichever sender domain the operator settles on) must
    be verified on the Resend dashboard. Until verified,
    `sendInviteEmail` returns `status='failed'` with reason
    `send_failed` and the toast surfaces the failure with a
    "resend later" hint. Invite rows still persist; admin can
    copy/share the URL via the existing accept link.
  - **Production env vars.** `RESEND_API_KEY` (Resend
    dashboard), `RESEND_FROM` (e.g. `'HandiBowls
    <no-reply@handibowls.co.za>'`),
    `EMAIL_UNSUBSCRIBE_SIGNING_SECRET` (operator-generated
    via `openssl rand -hex 32`). All four documented in
    `.env.example`.
  - **Supabase Realtime publication.** Cloud Supabase project
    must include `public.notifications` in the
    `supabase_realtime` publication for the bell to receive
    INSERT/UPDATE deltas. Verified during the user's manual
    11-5 walkthrough.
- **Phase 12 readiness.** Plan §15 scope is cross-cutting
  stats / history / calendar / optional handicap. Phase 12
  inherits 6 fresh follow-up entries from 11-6, plus the
  pre-existing Phase-12-owned drift items (tournament greens
  link, Fair Rink column, tournament drafts, BSA seeding
  algorithm verification, telemetry sweep). The
  `audit_log_visible_to_admin` helper extension to cover
  `'club_memberships'` / `'club_admin_assignments'` rows
  written in 11-4 is a Phase 12 task — super-admins can read
  them today via the `super_admin_all` policy; club-admin
  visibility into membership audits requires the helper
  extension. No new Phase 11 work blocks Phase 12.

---

## Phase 12 — Stakeholder polish — in progress

The phase opens against a triage artefact (`DRIFT_TRIAGE_PHASE12.md`)
classifying the 63 open drift entries at the Phase 12 boundary into
12 MUST / 8 NICE / 18 DEFER → Phase 13 / 15 DEFER → future / 9 REWORD
/ 1 PARKED. Sub-checkpoints land MUST + NICE entries grouped by
surface; DEFER entries roll forward. Effort framing dropped per
stakeholder call — Phase 12 ships when work ships.

### 12-prep — branch cut + DRIFT triage application — closed 2026-04-30

- **Branch tip:** `1b20559` (`rebuild/phase-12-stakeholder-polish`,
  cut from `005b8af` Phase 11 close).
- **Two atomic commits:** `9f77b73` (12-prep-1, triage artefact frozen)
  + `1b20559` (12-prep-2, DRIFT_LOG sweep applying R1-R9 rewrites,
  consolidations, re-owners, user-call updates, and the new
  top-level `## Decisions` sub-section between `## Other phases` and
  `## Closed items`). 9 REWORD entries became MUST / NICE /
  DEFER → 13 / DEFER → future / DROP / RECLASSIFIED-as-Decision per
  triage. Three Decision-doc entries promoted out of the nested
  Phase 12.5 / Admin chrome sub-section.
- **Drift delta at 12-prep close:** 63 → 58 open / 22 → 30 closed.
  Net −5 open: −2 from L171 + L182 reclassify-to-Decisions + −3
  from consolidations net of splits (R3 +1 / R4 0 / R7 +1 vs four
  consolidation strikes).

### 12-3 — Messaging admin polish + notification system fixes — closed 2026-04-30

- **Branch tip:** `31fb77f` (`rebuild/phase-12-stakeholder-polish`).
- **Two atomic commits:**
  - `050f881` (12-3 step 1) — Migration 040. Two changes bundled:
    (a) `invites.email_status / email_error / email_sent_at`
    columns + CHECK constraint pinning the allowed status values
    so Resend-invite UI can render conditionally on the
    persisted state; (b) CREATE OR REPLACE
    `admin_schedule_t20_assessment` so the notification INSERT
    writes `related_kind='t20_assessment'` (was 'booking') —
    lets the bell route to /t20 directly without a booking-
    purpose lookup. Cloud + local in sync at 40 migrations.
  - `31fb77f` (12-3 step 2) — Application code for both Block A
    (messaging admin polish) and Block B (notification system
    fixes). Single commit — the two blocks share the
    NotificationsBell change set and the messages list/edit
    plumbing (B1 Inbox/Sent split + A3 edit-draft button on
    list rows). Splitting would have left interdependencies
    awkward.
- **Block A — messaging admin polish (4 closures):**
  - **A1 Live recipient-count preview** — new
    `previewAudienceCount` Server Action wraps the existing
    `resolveAudienceCount` fetcher; new `<AudienceCountPreview>`
    Client island below the audience picker debounces (300ms)
    on audience changes, renders `Estimated recipients: N` via
    useTransition.
  - **A2 Resend invite button** — `sendInviteEmail` persists
    each attempt's outcome onto the invite row via the new
    migration 040 columns. New `resendInviteEmail(token)` Server
    Action; `<ResendInviteButton>` Client island in
    MembersTable rendered next to the Status badge for invite
    rows. Visible on `email_status` ∈ {null, 'failed',
    'skipped'}; hidden on 'sent'.
  - **A3 Edit page for message drafts** — new
    `/manage/messages/[id]/edit/page.tsx` Server Component
    loads the draft via `getMessageDetail`, renders
    `<ComposeForm edit={...}>` with subject / body / audience
    pre-populated. Optional hidden `message_id` field switches
    `composeMessageFromForm` between create and update paths.
    wrong_state guard redirects non-draft rows back to the
    list. List-row "Edit draft" button on draft rows.
  - **A4 Remove Send-later UI** — ComposeForm Section 4
    (Schedule with Send-now / Send-later radios) deleted. Form
    now has 4 sections + two CTAs (Save as draft / Send now).
    `compose_action='schedule'` branch removed from the action;
    `ComposeAction` type narrowed to `'save_draft' | 'send_now'`.
    MessagesListClient status chips dropped 'queued' (5 → 4).
- **Block B — notification system fixes (4 closures + 1 deferral):**
  - **B1 Inbox / Sent tabs on /manage/messages** —
    `listMessagesForClub` takes a `mode` param (default 'inbox');
    page reads `?tab=inbox|sent` from search params, applies
    sender_id filter. URL-driven tabs strip rendered server-side.
    EmptyDataState branches on mode (Inbox = no compose CTA;
    Sent = retains compose CTA).
  - **B2 Bell role-branched relatedHref** — `<NotificationsBell>`
    takes a `role: BellRole` prop. Layouts pass role per chrome.
    Pure helpers `resolveRelatedHref(role, n)` and
    `viewAllHref(role)` extracted + exported. 14 new test cases
    pin every cell of the (player|club_admin) × related_kind
    routing matrix.
  - **B3 t20_assessment_request deep link** — covered by B2's
    club_admin + 'message' branch. MessageRow renders
    `id="message-{row.id}"` with scroll-mt-24 + target:ring-2;
    bell click on a t20-request notification routes to
    `/manage/messages?tab=inbox#message-{id}`.
  - **B4 t20_assessment_scheduled deep link** — migration 040
    changed the RPC's notification INSERT to write
    `related_kind='t20_assessment'`; resolveRelatedHref's
    player branch routes that kind to `/t20`. Pre-existing rows
    fired since 12-1 followup carry the old 'booking' literal
    and continue to route to /book; no backfill.
  - **B5 "View all" link** — covered by B2.
  - **B6 Super-admin bell** — DEFERRED per locked user call.
    Drift entry "Super-admin notifications bell missing"
    opened under Cross-cutting + post-v1.
- **Drift entries closed (5):**
  - Resend invite button missing in admin UI (L167)
  - Live recipient-count preview missing on /manage/messages/new (L168)
  - Notification bell role-leak (12-1 followup entry)
  - No edit page for existing message drafts (L169)
  - Remove "Send later" option from message compose form (R7a)
- **Drift entries opened (2):**
  - "Super-admin notifications bell missing" — Cross-cutting +
    post-v1 / v2. Deferred per locked user call at 12-3 open.
  - "Personal theme override (post-v1 / v2)" — Cross-cutting.
    Profile-level override of club default theme preset; data
    + UI plumbing only.
- **Test deltas:** 1184 → 1181 unit (net −3: +14 in
  NotificationsBell.test.tsx for the resolveRelatedHref +
  viewAllHref matrix; −12 obsoleted in messages-compose.test.tsx
  for Send-later UI; −5 from 12-1 followup ctaCopyFor that
  already cleared; +1 split in messages-list for empty-state
  CTA visibility per mode; −1 status-chip count adjustment).
  106 → 111 integration (no new this checkpoint — Block B is
  pure helpers; Block A wraps already-tested infrastructure).
- **Migrations applied:** 040.
- **Verification gates at close:** tsc clean / lint 0 errors
  (19 pre-existing warnings) / 1181 unit / 111 integration /
  build green.

### 12-2 — Tournament admin gaps — closed 2026-04-30

- **Branch tip:** `3263cb1` (`rebuild/phase-12-stakeholder-polish`).
- **Two atomic commits:**
  - `a71c350` (12-2 step 1) — Migration 039. Schema only, two-commit
    rule. Adds `tournaments.fair_rink boolean not null default true`
    and the `tournament_greens` join table (composite PK on
    (tournament_id, green_id) + indexes on both columns + ON DELETE
    CASCADE on tournament_id, RESTRICT on green_id). RLS mirrors
    tournaments — super_admin all / club_admin (host) rw via
    EXISTS-join to tournaments.host_club_id / member-or-participant
    SELECT via the same is_tournament_participant helper. Cloud +
    local in sync at 39 migrations.
  - `3263cb1` (12-2 step 2) — Application code. createTournamentSchema
    accepts fair_rink (default true) + green_ids (default []);
    createTournament action persists fair_rink on the tournaments row
    and fans out green_ids to tournament_greens. Greens picker helper
    text rewritten ("Selected greens scope which surfaces the rink-
    fairness algorithm picks from at match scheduling"). Disabled
    "Save as draft" button removed per locked user override. AuditTab
    empty-state copy replaced with neutral "No audit events recorded
    for this tournament yet" + an event-kind explainer. closeEntries
    gate verified — canonical helper at
    `components/tournament/EntriesGatePill.tsx:24-37` already
    implements `(status='open' AND (entries_close_at IS NULL OR
    entries_close_at > now()))` exactly per spec; no code change
    needed.
- **Drift entries closed:**
  - "Phase 7b cross-cutting tournament migration" (L174 + L175
    consolidated — tournament_greens join table + fair_rink column).
  - "AuditTab empty-state copy fix" (R3a / L61 split).
  - "closeEntries gate semantics — Phase 7 mirror verification"
    (R5 / L136 — verified shipped, no code change).
  - "Tournament drafts: remove disabled Save-as-draft button"
    (L176 — button removed; saveTournamentDraft not wired;
    `tournament_status='draft'` enum value retained for any
    future post-v1 reintroduction).
- **Drift entries opened (1):**
  - "Tournament edit page missing" (Phase 12.5) — no
    `/manage/tournaments/[id]/edit` route exists; `updateTournament`
    action doesn't exist. 12-2 wiring of green_ids + fair_rink
    therefore covers create only. Foundation in place; right fix is
    documented in the entry (copy /new structure to /edit, add
    updateTournament, handle tournament_greens add/remove diff).
- **Test deltas:** 1177 → 1184 unit (+7: +3 createTournament cases
  on the new fields + 4 AuditTab copy assertion cases + 1 rewrite
  of the existing draft-button case in place); 106 → 111
  integration (+5 in `tests/rls/tournament-greens.test.ts` covering
  the host-admin rw / cross-club denial / member read / non-member
  empty-result branches).
- **Migrations applied:** 039.
- **Verification gates at close:** tsc clean / lint 0 errors (18
  pre-existing warnings) / 1184 unit / 111 integration / build green.

### 12-1 — Player-side completeness — closed 2026-04-30

- **Branch tip:** `6f67b45` (`rebuild/phase-12-stakeholder-polish`).
- **Four atomic commits:**
  - `7beb570` (12-1) — player `/t20` read surface per design source
    `handibowls/project/player-pages.jsx:182` `PageT20`. Server
    Component hero (primary-club themed band with SpeckleField +
    SplatterAccent), grade pill ladder (Bronze → Silver → Gold →
    Platinum), tier-aware copy via `computeLadder` + `heroCopyFor`
    pure helpers, "What is Twenty 20?" explainer, upcoming-empty-
    state, past-assessments list. Initial CTA routed to `/me`
    pending the scheduling backend; replaced in the followup.
  - `db9b95e` (12-1 followup) — `lib/auth/routing.ts:13`
    `PLAYER_PREFIXES` extended with `/t20`. Manual-QA-discovered
    silent regression: clicking the bottom-nav "20/20" tab
    redirected back to `/play` because the proxy classified `/t20`
    as an unknown route and bounced authenticated players to
    `homeFor("player")`. Test added at `tests/auth/routing.test.ts`.
  - `d19e09b` (12-1 followup) — migrations 036 + 037. Migration 036
    extends `booking_purpose` enum with `'t20_assessment'` (alone
    in its file because ALTER TYPE ... ADD VALUE values can't be
    USED in the same transaction). Migration 037 ships the
    `bookings.for_profile_id` column + check constraint enforcing
    `purpose='t20_assessment' iff for_profile_id IS NOT NULL`,
    plus the two SECURITY DEFINER RPCs `request_t20_assessment`
    (player-callable; mirrors `send_message` fan-out logic
    inlined to permit player callers; soft 24h cooldown via
    duplicate-subject lookup) and `admin_schedule_t20_assessment`
    (admin-callable; inserts booking + fires player notification
    atomically; surfaces `slot_taken` on overlap).
  - `6f67b45` (12-1 followup) — request → schedule → notify loop
    end-to-end. Player CTA replaced with single tier-agnostic
    "Request assessment" wired to `requestT20Assessment` Server
    Action. `/manage/messages` detects request rows by subject
    prefix `"Twenty 20 assessment request — "`; renders a
    "Schedule from this request" CTA that deep-links to
    `/manage/bookings/new?player_id=...&request_message_id=...`.
    New `/manage/bookings/new` route shipped t20-assessment-only
    (general-purpose admin booking creation deferred per drift
    entry). Form calls `adminScheduleT20Assessment` action
    wrapping the RPC; success → redirect to `/manage/overview`,
    player notification fires automatically via the RPC's
    in-transaction insert. `/t20` upcoming-assessments section
    populated from `bookings` filtered by `for_profile_id =
    auth.uid() + purpose='t20_assessment' + ends_at > now`.
    Bundled with this commit: migration 038 fixing two latent
    bugs in 037 surfaced by the integration suite — ambiguous
    `message_id`/`recipient_count` references (RETURNS TABLE
    columns shadow column names of the same name in pl/pgsql) and
    `r.club_id` referenced rinks.club_id which doesn't exist
    (FK chain is rinks → greens → club_id). DROP + CREATE for
    both functions; signatures preserved.
- **Drift entries closed:**
  - L166 (Player-side `/t20` page never built) — read-only at
    7beb570, action surface at 6f67b45.
  - 12-1 close entry "Player /t20 hero CTA scheduling-backend
    deferred" — replaced by the loop.
- **Drift entries narrowed:**
  - "Scheduled-send infrastructure (deferred)" — was bundled with
    the T20 Schedule-next button at Phase 12 triage on the
    assumption they shared a dispatcher dependency. After 12-1
    followup landed the request → schedule loop (admin-driven,
    not scheduler-driven), the T20 portion is satisfied
    independently. Entry now scopes to messaging dispatcher only.
- **Drift entries opened:**
  - "Notification bell role-leak" (12-3, Messaging admin polish)
    — manual-QA-discovered bug pre-dating 12-1; bell fetches
    profile-scoped (not role-scoped) notifications and routes to
    `/me/inbox` regardless of role.
  - "Admin general booking creation form is t20_assessment-only"
    (Phase 12.5) — `/manage/bookings/new` was created as a
    t20-only form; logs the right-fix shape for general-purpose
    admin booking creation when needed.
  - "tests/lib/email/unsubscribe.test.ts base64url tamper-rejection
    flake" (Phase 13) — pre-existing test design flaw surfaced
    once during 12-prep full-suite run; passes cleanly on isolated
    re-runs and full re-runs.
- **Test deltas:** 1163 → 1177 unit (+14 net: −5 ctaCopyFor cases
  obsoleted by the single-CTA model, +16 in the new
  `tests/app/player/t20-page.test.ts`, +3 t20-request-detection
  cases on `MessagesListClient`); 96 → 106 integration (+10 in
  `tests/rpc/t20-assessment-loop.test.ts` covering the four
  request_t20_assessment kinds + six admin_schedule_t20_assessment
  kinds). Third gate stayed clean: lint 0 errors / 18 pre-existing
  warnings; tsc clean; build green; cloud + local in sync at 38
  migrations.
- **What 12-1 closes for v1:** marketing landing page promise
  satisfied — the public `ShowcaseT20` section advertised the
  player Twenty 20 hub view; `/t20` now ships with grade history,
  tier ladder, and a real request → schedule → notify loop. The
  underlying capability for "Schedule next" (T20 results view) is
  in place; UI affordance is a Phase 12.5 question.

---

## Operational conventions

- **Browser-driven QA is human-side throughout the rebuild.** Multi-viewport visual checks and Lighthouse performance audits run on a real browser / device by the human at phase close — Claude Code cannot drive a browser in this WSL container (Playwright + chrome-devtools MCPs both fail to attach). Claude Code's QA scope is limited to code review against the design source + curl-level route checks. Subsequent phase briefs and stop-and-reports drop the "mandatory mobile QA at 4 viewports" item from Claude's gate list. Recorded: 2026-04-29 (post Phase 8 first batch).
- **Bot-opponent matches confirm via admin verifyMatch override in dev QA.** Seeded bot opponents (e.g. `bot.opponent@demo.local`) can't drive the OpponentConfirmationCard's "Confirm" tap since no human is logged in to the bot account. Dev QA flow uses club_admin's verifyMatch with `override_home_shots` / `override_away_shots` to advance bot-opponent matches past the captain-submitted state — same path real ops uses for dispute resolution. No seed-side auto-confirm, no dev-only UI. Recorded: 2026-04-29 (Phase 8d).
- **"Autumn Singles Final · 21-14 win" on `/play` is intentional seed data.** The third tournament from `scripts/seed-dev-tournaments.ts` is fully completed with a finalised match against the seeded bot opponent — its purpose is to drive the player home page's `<RecentResults />` surface so the empty-state vs populated-state branches both have reproducible visual coverage. Manual QA "Where did 21-14 come from?" is the expected reaction; the answer is the seed. Recorded: 2026-04-28 (Phase 8d follow-up Finding 15).

---

## Append-on-close protocol

Future phases follow the same template. When a phase closes:

1. Verification gates (typecheck, lint, tests, RLS suite, build) all
   green; branding grep returns zero.
2. Manual visual QA performed by the user.
3. Drift log open / closed counts captured before and after the phase.
4. Lighthouse re-run if the phase touched a redesigned surface (target
   ≥85 desktop performance).
5. **Append the new phase's entry to this file** — branch tip SHA,
   sub-checkpoints shipped, migrations applied, drift delta, manual
   QA result.
6. Commit (`phase-N: append PHASE_LOG entry`) → push the phase branch
   → final stop-and-report.

The order matters: this file is the last write before push. If something
breaks afterwards, the entry rolls back with the rest of the phase.
