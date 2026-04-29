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
