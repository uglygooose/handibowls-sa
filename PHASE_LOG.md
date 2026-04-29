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

## Operational conventions

- **Browser-driven QA is human-side throughout the rebuild.** Multi-viewport visual checks and Lighthouse performance audits run on a real browser / device by the human at phase close — Claude Code cannot drive a browser in this WSL container (Playwright + chrome-devtools MCPs both fail to attach). Claude Code's QA scope is limited to code review against the design source + curl-level route checks. Subsequent phase briefs and stop-and-reports drop the "mandatory mobile QA at 4 viewports" item from Claude's gate list. Recorded: 2026-04-29 (post Phase 8 first batch).
- **Bot-opponent matches confirm via admin verifyMatch override in dev QA.** Seeded bot opponents (e.g. `bot.opponent@demo.local`) can't drive the OpponentConfirmationCard's "Confirm" tap since no human is logged in to the bot account. Dev QA flow uses club_admin's verifyMatch with `override_home_shots` / `override_away_shots` to advance bot-opponent matches past the captain-submitted state — same path real ops uses for dispute resolution. No seed-side auto-confirm, no dev-only UI. Recorded: 2026-04-29 (Phase 8d).

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
