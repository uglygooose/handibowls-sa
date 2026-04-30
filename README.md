# HandiBowls

> Tournaments, scores, and skills in your pocket — for South African lawn bowls.

HandiBowls is a Bowls South Africa–native platform for running club, district, and national tournaments, booking greens, running T20 skill assessments, and communicating with members. Mobile-first for players, desktop-first for admins, offline-capable scoring.

## Status

**Rebuild in progress — Phase 12 in progress. 12-1 + 12-2 + 12-3 closed (player Twenty 20 hub with request → schedule → notify loop; tournament admin gaps closed; messaging admin polish + notification bell role-branching shipped).** This repository is being rebuilt from a fresh Supabase project, fresh routing, a fresh design system, and a three-role architecture. See [`HANDIBOWLS_REBUILD_PLAN.md`](HANDIBOWLS_REBUILD_PLAN.md) for the phase-gated plan and [`PHASE_LOG.md`](PHASE_LOG.md) for the canonical progress tracker.

Phases shipped to date:

- **Phase 0–4** — teardown · design system · auth shells · schema · demo club CRUD
- **Phase 5–7** — player onboarding · tournament engine · admin tournament UI
- **Phase 8–9** — player tournament + booking surfaces · admin booking + audit log
- **Phase 10** — Twenty 20 assessment module (production rubric)
- **Phase 11** — in-app messaging + system-triggered InviteEmail (revised mid-phase from "email + in-app" to in-app primary; clubs handle their own member email externally in v1)
- **Phase 12** _(in progress)_ — stakeholder polish, sub-checkpoints landing per `DRIFT_TRIAGE_PHASE12.md`. **12-1 closed:** player Twenty 20 hub at `/t20` with grade ladder + tier-aware copy; player-initiated assessment requests fan out to club admins as in-app messages + notifications; admin one-click schedule from `/manage/messages` deep-links to a t20-assessment booking form that fires a player notification on save. **12-2 closed:** tournament admin gaps — `tournament_greens` join table + `tournaments.fair_rink` column shipped (migration 039); the create form now persists both; disabled Save-as-draft button removed per the v1 carve-out; AuditTab empty-state copy fixed; closeEntries gate verified. **12-3 closed:** messaging admin polish + notification system fixes — live recipient-count preview on /manage/messages/new; Resend-invite button on members table (migration 040 persists email_status); /manage/messages/[id]/edit route for draft re-editing; Send-later UI removed from compose form; /manage/messages now splits into Inbox / Sent tabs; NotificationsBell role-branches click destinations and footer "View all" link to admin / player surfaces.

Pending: rest of Phase 12 stakeholder polish (12-4 onward) · technical polish (Phase 13). Open drift items tracked in [`DRIFT_LOG.md`](DRIFT_LOG.md).

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
