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

## Phase 7 — Tournament admin UI — closed 2026-04-28

- **Branch tip:** `b9ad0fa` (`rebuild/phase-7-tournament-admin-ui`,
  cut from `f1862f7`; PHASE_LOG bookkeeping commit lands on top)
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
- **Manual QA:** Lighthouse desktop on `/manage/tournaments/[id]`:
  **Performance 86 / Accessibility 100 / Best Practices 96 / SEO 91**
  (target ≥85 met). Suite at 418 tests passing (343 baseline + 75
  Phase-7e additions). RLS suite 49/49 green against cloud. Manual
  visual walkthrough is the user's job — see Phase 7 close report
  for the manual QA checklist.

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
