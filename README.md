# HandiBowls

> Tournaments, scores, and skills in your pocket — for South African lawn bowls.

HandiBowls is a Bowls South Africa–native platform for running club, district, and national tournaments, booking greens, running T20 skill assessments, and communicating with members. Mobile-first for players, desktop-first for admins, offline-capable scoring.

## Status

**Rebuild in progress.** This repository is being rebuilt from a fresh Supabase project, fresh routing, a fresh design system, and a three-role architecture. See [`HANDIBOWLS_REBUILD_PLAN.md`](HANDIBOWLS_REBUILD_PLAN.md) for the phase-gated plan. Current phase: **0 — teardown & fresh setup**.

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

Additions land phase by phase: TanStack Query/Table, React Hook Form + Zod, Dexie (offline scoring), Serwist (PWA), Resend (email), React PDF.

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
