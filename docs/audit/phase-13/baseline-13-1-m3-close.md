# Phase 13 / 13-1 — M3 Close + Stage 2 Close-Gate Verification

Pre / post baselines captured against Vercel previews via
`scripts/baseline-13-1.mjs --label=m{1,2,3}-{pre,post,close}`.

## Stage 2 close-gate verdict — **MET**

| Gate target | M1 close | M2 close | M3 close |
|---|:---:|:---:|:---:|
| Lighthouse Accessibility ≥ 95 on all 10 | n/a (auth blocked) | 7/10 | **10/10 ✓** |
| axe critical violations = 0 on all 10 | n/a (auth blocked) | 10/10 | **10/10 ✓** |

Both halves clear. Lowest a11y score is 96 (was 88 at M2-pre on
`/manage/tournaments/[id]`, the L67 surface).

## Per-surface — full M2 → M3 delta

| Surface | M2 a11y | M3 a11y | Δ | M2 axe c/s/m/n | M3 axe c/s/m/n | axe Δ |
|---|---:|---:|---:|---|---|---|
| / (landing) | 98 | **100** | +2 | 0/0/1/0 | 0/0/0/0 | -1m |
| /login (auth) | 100 | 100 | 0 | 0/0/0/0 | 0/0/0/0 | — |
| /play (player home) | 94 | **96** | +2 | 0/1/1/0 | 0/1/0/0 | -1m |
| /tournaments/[id] (player) | 96 | 96 | 0 | 0/1/0/0 | 0/1/0/0 | — |
| /t20 (player T20 hub) | 94 | **96** | +2 | 0/1/1/0 | 0/1/0/0 | -1m |
| /me (player profile) | 94 | **96** | +2 | 0/1/1/0 | 0/1/0/0 | -1m |
| /manage (club admin) | 96 | 96 | 0 | 0/1/0/0 | 0/1/0/0 | — |
| /manage/tournaments/[id] | **100** | 100 | 0 | 0/0/0/1 | 0/0/0/1 | — |
| /manage/members (Tier E) | 100 | 100 | 0 | 0/1/0/0 | **0/0/0/0** | -1s |
| /platform/clubs (super admin) | 100 | 100 | 0 | 0/0/0/0 | 0/0/0/0 | — |

Aggregate vs M2 close: **+2 a11y on 4 surfaces · −4 moderate · −1 serious · 0 regression on any surface.**

## What each commit closed

| Commit | SHA | Closed |
|---|---|---|
| 8a — NotificationsBell → Popover | `77b6bd6` | Stage 1 §3 #10 (manual `role="dialog"` no focus trap, no aria-modal) |
| 8b — Rubrics 3 modals → Dialog | `a2acdd8` | Stage 1 §3 #11 (3 manual modals no focus management / restoration) |
| 9 — carry-forwards + primitives | `e781343` | OfflineSyncBadge contrast (M2 carry-forward, dominant a11y gap on player surfaces); PlayerSectionHead h3→h2 (player heading-order); EntriesTab residual checkbox columnheader; Skeleton aria-busy; Scoreboard live region; PasswordStrength aria-live |
| 10 — marketing landing | `59aff29` | Footer h4→h3 (landing heading-order); FeatureGrid card aria-labelledby; AuthAside Bowl decorative aria-hidden |
| 11 — virtualized tables | `d395ac7` | MembersTable + super-admin MembersTab role="grid" + scrollable rowgroup tabIndex (closes /manage/members serious scrollable-region-focusable; consistent ARIA grid pattern across all 3 virtualized surfaces — EntriesTab landed at M2 commit 6) |

## Residual axe-serious findings — informational, NOT close-gate-blocking

5 surfaces still carry 1 axe-serious each (down from 1-2 each at M2). All are
the same **tinted-pill / opacity-modifier contrast theme** as the
OfflineSyncBadge fix in commit 9, but on DIFFERENT components:

- **/play (6 nodes color-contrast)** — `HeroNextMatch` pill `bg-white/90 text-accent-ink` + `text-[color:var(--color-on-primary)]/85` + similar tinted pills on the hero
- **/tournaments/[id] (1 node)** — `bg-primary-500/12 text-accent-ink` "End total" pill on TournamentCard. `accent-ink` resolves to `primary-500` on 7 of 9 themes — primary-on-primary-tint (~3.7:1, same pattern OfflineSyncBadge had pre-fix)
- **/t20 (4 nodes)** — grade ladder `bg-white/10` translucent-white pills with white labels (Bronze / Silver / Platinum) — multi-layered tint
- **/me (8 nodes)** — `bg-info-500/12 text-info-500` purpose-pill (info-500 variant of the OfflineSyncBadge pattern); `text-ink-muted text-[11px]` party-meta strings
- **/manage (2 nodes)** — `text-danger-500/80` strikethrough + audit-action-pill `bg-danger-500/12` style

**Recommended follow-up DRIFT entry:** "Tinted-pill foreground contrast — class-of-bug" — codify a single tinted-pill primitive that handles the foreground swap to `text-ink` for theme-invariant high contrast. 5+ inline implementations across player + admin chrome use the same pattern; a primitive sweeps them all in one commit. Owner: Phase 13 follow-up sub-stage OR post-launch quality pass.

## Residual axe-minor

1 node on `/manage/tournaments/[id]`: `<div role="columnheader"></div>` at
`:nth-child(9)` — the trailing actions columnheader. M2 commit 6 added an
sr-only "Actions" label conditioned on `h.column.id === "actions"`, but the
column's actual id may differ (TanStack Table assigns ids from columnDef;
without explicit id, auto-generates from header text or accessor — for an
empty-string header, the auto-id may not be "actions"). The conditional
doesn't fire, cell stays empty for axe.

**Recommended fix:** set explicit `id: "actions"` on the columnDef (1 LOC) OR
change the condition to match the LAST column unconditionally. Trivial,
non-blocking. Folds into the next 13-1 follow-up commit or a post-launch
sweep.

## Stage 2 close-gate met → 13-1 close commit recommended

Per the M3 brief: "If Stage 2 gate met → propose 13-1 close commit."

**Recommended 13-1 close commit composition:**

1. **PHASE_LOG.md** — append 13-1 entry: sub-checkpoint structure (M1 → M2
   → M3), commits + headline SHAs (~14 total commits across 13-1), baseline
   pre/post deltas at each milestone, Stage 2 close-gate verification, locked
   decisions across the phase.

2. **DRIFT_LOG.md** — close drift entries that 13-1 work resolved:
   - Line 70 [L67-followup] — the a11y portion of the Lighthouse <90 gap on
     `/manage/tournaments/[id]` clears at 100. Perf portion stays Phase 13-3
     scope (re-tag the entry to perf-only, or split into two entries).

3. **DRIFT_LOG.md** — open new drift entries for residuals:
   - Tinted-pill foreground contrast class-of-bug (5 surfaces, ~21 nodes
     across).
   - `/manage/tournaments/[id]` empty-table-header MINOR residual.
   - Service-worker registration gap (carried over from pre-M3 audit) —
     owner: Phase 13-3.

4. **README.md** state-line update.

Plus the M3 close summary doc (this file) is already in place.

Branch tip: `d395ac7`. Ready to compose 13-1 close on greenlight.
