# HandiBowls

> Tournaments, scores, and skills in your pocket — for South African lawn bowls.

HandiBowls is a Bowls South Africa–native platform for running club, district, and national tournaments, booking greens, running T20 skill assessments, and communicating with members. Mobile-first for players, desktop-first for admins, offline-capable scoring.

## Status

**Rebuild in progress — Phase 13 / 13-8 fully closed (pre-launch QA: demo seed + drift fixes). Batch A shipped a stakeholder-ready demo seed: orchestrator + two-stage reset (Stage 1 wipes RLS-test orphans, Stage 2 wipes prior demo runs) + 14-user / 2-club / ~150-row honest fixture footprint with full state-machine matrix coverage (51-case `seed:demo:verify` test); 60-club bulk-filler scope cut applied per the no-inflation rule; new `docs/DEMO_LOGINS.md` ships the operator handoff (credentials + 1-page demo script + 20-surface "show this" hints + 12-item pre-presentation checklist). Batch B closed 4 drift entries: `t20-explainer-handicap-system-implication` (sentence rewritten dropping the BSA-banned "official handicap and grading system" framing); `signup-form-error-state-clears-invalid-email` (email retains across error with red-border + AlertCircle, password clears, security best-practice preserved); `signup-confirmation-redirects-to-login-instead-of-app` (root cause was Supabase email-confirm flow uses `?token_hash=&type=` — added `verifyOtp` branch alongside the existing `?code=` `exchangeCodeForSession` branch, verified via Context7); `supabase-default-email-templates-unbranded` (operator pasted 6 HandiBowls-branded templates from new `docs/SUPABASE_EMAIL_TEMPLATES.md` into Supabase Dashboard). Operator-confirmed Fix 2 end-to-end on Vercel preview: signup → confirmation email → `/me` with active session. Banked for launch / Phase 14: 13-3 real-device perf gate, full-scope close-verify scans, custom domain cutover + Resend domain verification + DMARC, final DNS-vs-preview launch-posture decision. Phase 13 itself stays open until the DNS-dependent launch infrastructure lands.** This repository is being rebuilt from a fresh Supabase project, fresh routing, a fresh design system, and a three-role architecture. See [`HANDIBOWLS_REBUILD_PLAN.md`](HANDIBOWLS_REBUILD_PLAN.md) for the phase-gated plan and [`PHASE_LOG.md`](PHASE_LOG.md) for the canonical progress tracker.

Phases shipped to date:

- **Phase 0–4** — teardown · design system · auth shells · schema · demo club CRUD
- **Phase 5–7** — player onboarding · tournament engine · admin tournament UI
- **Phase 8–9** — player tournament + booking surfaces · admin booking + audit log
- **Phase 10** — Twenty 20 assessment module (production rubric)
- **Phase 11** — in-app messaging + system-triggered InviteEmail (revised mid-phase from "email + in-app" to in-app primary; clubs handle their own member email externally in v1)
- **Phase 12** — stakeholder polish across seven sub-checkpoints. **12-1:** player Twenty 20 hub at `/t20` with grade ladder + request → admin-schedule → notify loop (migration 037). **12-2:** tournament admin gaps — `tournament_greens` join + `tournaments.fair_rink` column (migration 039); create form persists both; AuditTab empty-state copy. **12-3:** messaging admin polish — live recipient-count preview, Resend-invite button (migration 040), draft edit page, Send-later removed, Inbox/Sent tabs, NotificationsBell role-branching. **12-4:** T20 admin polish — coach-categorised notes via migration 041 (jsonb + CHECK) + 3-tile editor; R1/R2 splits from `delivery.round`; finalize-hotfix (percentage clamp + notes-schema reshape + silent-RLS-denial guards) with new integration test. **12-5:** performance sweep — bundle reductions of 17–47% across player routes (BookingSheet / DisputeForm / OpponentConfirmationCard lazy-loaded; dexie gated via `DynamicSyncBadgeMount`); Lighthouse re-runs recorded. **12-6:** design fidelity sweep — ShowcaseT20 wedge labels + grade legend + metadata; auth Checkbox → shadcn primitive. **12-7:** pre-stakeholder QA + cross-cutting fixes — search-pagination fix on `/platform/clubs`; eight-file stale-phase-string copy sweep.
- **Phase 12.5** — design fidelity & unification across nine sub-checkpoints. **12.5-prep:** audit package + DRIFT triage. **12.5-1:** foundation primitives (`<EmptyState>` + `<MobileTabBar>` + radius-scale codified). **12.5-2:** theme + speckle (`SpeckleField.seedKey` + `intensity` tier; `lib/brand/grade.ts` extracted; `<StubPage>` re-bodied via `<EmptyState>`). **12.5-3:** T20 admin polish (`<RubricSchemaDialog>`, list URL-driven filters, capture-cancel `<AlertDialog>` + `discardAssessment`). **12.5-4:** player Twenty 20 results detail view (NEW route at `/t20/[assessmentId]`). **12.5-5:** tournament edit page (NEW route at `/manage/tournaments/[id]/edit`) with optimistic-locking. **12.5-6:** visual unification (`<AdminPageHero>` primitive at the bundle's `.page-hero` contract; 21 admin + super-admin surfaces migrate; `<PageHeader>` retired; safe-area-aware MobileShell padding; loading-state Skeleton trees by role; icon-scale lock + grep-guard; `<LengthDistributionChart>` brand decoration). **12.5-6.5:** player surface unification (`<PlayerHero>` + `<PlayerSectionHead>` primitives; 3 identity surfaces on PlayerHero; player body copy 13 → 15 px; no-hero h1 visually-hidden via `sr-only`). **12.5-7:** pre-stakeholder QA + close (scrollbar-gutter stability fix + super-admin loading-wrapper alignment + SpeckleField numeric-consumer reconcile + minimal Twenty 20 dev seed + form-tier retirement + /platform/clubs/new back affordances). No migrations applied during Phase 12.5 — pure design-fidelity + primitive-extraction pass.
- **Phase 13** — launch prep (in progress). **13-1:** a11y audit + WCAG 2.1 AA fixes across the 10 anchor surfaces — `--accent-ink` token + 71-instance `text-primary-500` sweep for sunburst / white-speckle text-on-light fallback; skip-to-content + landmark wiring; Field auto-id + describedby; tournament-detail heading hierarchy + tabpanel + ARIA grid pattern across virtualized div-tables (TanStack Virtual + `transform: translateY()` is incompatible with semantic `<table>`); TanStack Table `aria-sort` + pagination context; NotificationsBell manual modal → shadcn Popover; RubricsClient 3 modals → shadcn Dialog; tinted-pill foreground class-of-bug eliminated across 25+ surfaces via theme-invariant `text-ink` swap; EntriesTab columnheader id fix. Stage 2 close-gate met (Lighthouse a11y ≥95 on all 10, axe critical = 0 on all 10, axe serious = 0 on `/manage/tournaments/[id]`); 1 residual on `/me` deferred to 13-3 as a token-level decision (`text-ink-muted` global token at 3.13:1 on bone — app-wide blast radius). 4 follow-up DRIFT entries opened (service-worker registration gap, `text-ink-muted` token review, /t20 hero eyebrow theme-coupling, hover-pseudo-state contrast audit). **13-2a:** security sweep across 4 batches — Batch A read-only audits (7 entries: profile_id confusion / PostgREST embeds / state-machine matrix / server-only poisoning / 'use client' taint / service-role bundle grep / auth rate-limit), Batch B test infrastructure (RLS test cleanup hardening for ON DELETE RESTRICT children + 9 action-wrapper integration cases for adminScheduleT20Assessment + sendMessageNow + base64url tamper-rejection flake fix), Batch C atomic RPC (migration 042 — `public.activate_rubric_version(p_version_id uuid)` SECURITY DEFINER + `t20_rubric_versions.activated_by` audit-trail column; replaces sequential UPDATE+UPDATE in the application layer with a single atomic transaction wrapped in `pg_advisory_xact_lock`; 7 RLS cases pin the contract on cloud), Batch D-CSP Content-Security-Policy-Report-Only headers (`next.config.ts` `headers()`; locked allow-list Supabase + Vercel + Resend; `'unsafe-inline'` for styles only per Tailwind 4 trade-off; Vercel preview production build surfaced 0 violations). 4 follow-up DRIFT entries opened (state-machine-enum-hygiene, server-action-rate-limit-monitoring, csp-style-nonce-hardening, csp-authenticated-surface-violation-capture). 1 migration applied (042). 17 new integration cases (119 → 136). **13-2b:** POPIA compliance across 4 batches — Batch E migration 043 (schema: `profiles.deleted_at` + `pending_auth_ban` + `auth_banned_at` + `audit_log.retention_category` enum + pg_cron extension), Batch F migration 044 RLS soft-delete filter via PII-presence check + 12 RLS cases pinning the three-state visibility (active / grace window / anonymised), Batch G server actions (`requestAccountDeletion` / `restoreAccount` / `superAdminInitiateDeletion` with last-super-admin guard) + `/api/me/export` JSON data-portability endpoint covering 16 query passes + migration 045 pg_cron schedules (anonymise nightly + audit retention) + `/api/cron/anonymise-pending` Vercel Cron handler for the Supabase Auth Admin API ban call (hybrid pg_cron + Vercel Cron model), Batch H `lib/format/profile-display.ts:formatPlayerName` helper + cross-user surface sweep across 6 data files / 3 components + `/me/settings/data-and-privacy` sub-route + GraceWindowBanner mounted layout-level. 4 follow-up DRIFT entries opened (admins-without-club-memberships RLS gap, partial-profile vs anonymised display conflation, `Date.now()` in Server Components React Compiler pattern, Vercel Cron secret pre-deploy checklist). 3 migrations applied (043 / 044 / 045); pg_cron schedules registered + active. 17 new unit cases + 18 new integration cases (1376 → 1393 unit; 148 → 166 integration). DRIFT counts: 47 / 96 → 50 / 97. End-to-end deletion lifecycle wired: soft-delete → 30-day grace → pg_cron anonymise → Vercel Cron ban. **13-3:** perf measurement + visual residuals + a11y class-of-bug across thirteen commits (scoping → Batch I SW registration via `@serwist/next` SerwistProvider → Batch J hover-state contrast on 3 surfaces + /t20 hero eyebrow → Batch J-fixup landing accent revert to preset-primary → skills inventory side-quest → Batch K-prep diagnostic surfacing parent-opacity-on-text class-of-bug → Batch K dropping opacity-60/70/40 on /me + /book/SlotList + /book/DateStrip in favour of token-driven surface tiers → vercel.json cron daily schedule for Hobby-plan compatibility → Batch L 175-caller `rounded-xl` → `rounded-[14px]`/`[10px]` tier sweep across 88 files → Batch M-fixup three contrast residuals surfaced at M-execution against ocean-blue-themed seed user). Perf threshold gate (Lighthouse ≥90 player / ≥80 admin) deferred to 13-8 real-device confirmation per locked DRIFT-L67-followup acceptance criterion — WSL Chrome instability contaminates measurement uniformly across all 10 anchor surfaces. Final close-verify scan against Vercel preview at branch tip 950c8f3: 0 axe critical / 0 axe serious / 0 axe moderate / 0 axe minor across the full anchor set. DRIFT counts: 50 / 97 → 50 / 102 (5 closes + 3 new opens at close). **13-4:** SEO + landing brand story + favicon across six commits (scoping → Batch A landing truthfulness rewrite + Twenty 20 reframe + Quote testimonial deletion + SocialProof "Built for BSA" repurpose → Batch B mobile landing whitespace fix via art-column min-h tighten + main-bowl mobile-only positioning variant → Batch C /play HeroNextMatch viewer-driven theme via prop-drilled `resolveActiveTheme()` after pre-execution survey surfaced design-source conflict and visual revamp portion deferred to Phase 14 → Batch D canonical favicon set replacing placeholder mark with HandiBowls bowls-disc-with-jack-target glyph at simple/rich tiers across SVG + 16/32/48/64 + 180 + 192/512 + maskable variants + theme-color and manifest theme_color flipped to atomic-red `#D7261E` → Batch E SEO greenfield: `app/sitemap.ts` + `app/robots.ts` + `app/opengraph-image.tsx` rendering 1200×630 PNG via Next.js `ImageResponse` + `metadataBase` + `openGraph` + `twitter` blocks on root layout). Final 13-4-close-verify scan against Vercel preview at branch tip 35b765a: 0 axe critical / 0 axe serious across the full anchor set. DRIFT counts: 50 / 102 → 51 / 103 (1 close + 2 new opens at close).

Pending: Phase 13 close (gated on DNS access + custom domain wiring + Resend domain verification + real-device perf gate + final launch-posture decision). Phase 14 — post-launch polish + open DRIFT backlog. Open drift items tracked in [`DRIFT_LOG.md`](DRIFT_LOG.md).

**Operator-side prerequisites for Phase 11 production deployment:** Resend domain verification on the dashboard · production env vars (`RESEND_API_KEY`, `RESEND_FROM`, `EMAIL_UNSUBSCRIBE_SIGNING_SECRET`) · Supabase Realtime publication on `public.notifications`. Until the Resend domain is verified, invite rows still persist but the email send fails cleanly (toast surfaces a "resend later" hint).

Preserved from the previous iteration: tournament primitives (`lib/tournaments/`). Everything else is being rebuilt.

## Roles

- **super_admin** — platform operator; manages clubs, runs national tournaments.
- **club_admin** — runs their club(s); manages players, greens, tournaments, T20.
- **player** — mobile-first; scores, books, enters tournaments, completes T20.

## Stack

- Next.js 16, React 19, TypeScript 5 (strict)
- Tailwind v4 + shadcn/ui (Phase 1)
- Supabase (Postgres + Auth + Storage + Edge Functions + Realtime)
- Vitest, ESLint 9

Shipped through Phase 11: TanStack Query/Table (Phase 4d/7), React Hook Form + Zod (Phase 5b), Dexie outbox (Phase 8c), Serwist PWA (Phase 8d–8f), React PDF for tournament exports (Phase 7), Resend + @react-email/components for system-triggered InviteEmail + Supabase Realtime for the notifications bell (Phase 11). Pending: the Twenty 20 PDF template (Phase 10 follow-up).

## Getting started

```bash
npm install
cp .env.example .env.local    # fill in Supabase + Resend keys
npm run dev
```

## Scripts

```bash
npm run dev         # next dev
npm run build       # next build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest run (single-threaded; see note)
```

`npm run test` runs vitest with `--fileParallelism=false` to sidestep a reproducible vitest 4.x worker-pool-startup timeout on Windows + Node 24. CI (Ubuntu) is unaffected. `npm run test:watch` keeps default concurrency for faster feedback loops.


## Visual identity

HandiBowls uses a **Henselite-inspired speckle aesthetic** (bright, speckled bowl colours applied as surfaces and accents) with **no Henselite branding** — no logo, no name, no wordmarks. Nine theme presets (Atomic Red, Ocean Blue, Sunburst, Midnight, Ruby, Ocean Green, Grape, White Speckle, Core Black) ship in Phase 1; clubs pick one and it drives their app chrome.

## Licensing & data

- Product name: **HandiBowls**.
- BSA terminology used throughout (rink, Skip/Third/Second/Lead, shots up, ends, peel).
- Region: `af-south-1` preferred (data stays in South Africa), `eu-west-1` fallback.
- POPIA-compliant consent and unsubscribe pipelines.

## Contributing

Phase-gated — one phase per PR, referencing `HANDIBOWLS_REBUILD_PLAN.md`. See the plan for the phase checklist and the "App Review & Update Standards" appendix.
