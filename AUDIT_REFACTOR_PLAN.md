# HandiBowls SA — Audit Refactor Plan (Handoff)

> Handoff document for whoever picks up the remaining deferrals.
> Branch merged: `refactor/audit-fixes` → `main` (merge commit `b2fab8e`, 2026-04-22).

---

## Final status

**All 9 phases complete.** Merged to `main` (local) on 2026-04-22 via `--no-ff`.
Not yet pushed to `origin/main`.

**Merge totals:** 77 files changed, +13,464 / −8,377.

**Gates held throughout:**
- `npx tsc --noEmit` — 0 errors
- `npm test` — 81/81 passing (6 files)
- `npm run build` — 36 routes, 0 errors

**Top line-delta files in the merge:**

| File | Insertions | Deletions | Notes |
|---|---:|---:|---|
| `lib/database.types.ts` | 1505 | 0 | Generated Supabase types (Phase 1) |
| `app/admin/tournaments/[id]/views/RoundsView.tsx` | 1305 | 0 | Phase 9 split |
| `package-lock.json` | 1170 | 53 | Dep updates |
| `app/home/views/ClubNewsView.tsx` | 550 | 0 | Phase 9 split |
| `app/tournaments/[id]/views/BracketView.tsx` | 501 | 0 | Phase 9 split |
| `app/admin/tournaments/[id]/views/ControlView.tsx` | 477 | 0 | Phase 9 split |
| `app/match/[matchId]/page.tsx` | 463 | 546 | Net −83 (Phase 9.6) |
| `app/admin/tournaments/views/TournamentsListView.tsx` | 457 | 0 | Phase 9.5 split |
| `app/tournaments/views/TournamentCardView.tsx` | 382 | 0 | Phase 9.6 split |
| `app/admin/tournaments/[id]/page.tsx` | 343 | 2375 | Net −2032 (Phase 9 earlier pass) |

**Biggest net reductions:**

| File | Net Δ |
|---|---:|
| `app/admin/tournaments/[id]/page.tsx` | −2032 |
| `app/tournaments/[id]/page.tsx` | −1019 |
| `app/admin/tournaments/page.tsx` | −663 |
| `app/page.tsx` | −623 |
| `app/club-ladder/page.tsx` | −454 |
| `app/tournaments/page.tsx` | −345 |
| `app/my-challenges/page.tsx` | −270 |

---

## Phase-by-phase summary

### Phase 9 — Mega-file split (complete)

Phase 9 broke every `>500`-line client page into a shell + view(s) + (where applicable) a per-page `utils/` helper file. No behavioural changes — pure JSX relocation and props threading.

**9.5 — admin/tournaments list:**
- `app/admin/tournaments/page.tsx` 1470 → 845 shell
- `views/TournamentsListView.tsx` (457)
- `views/CreateTournamentModal.tsx` (329)
- `utils/dates.ts` (12)

**9.6 — final 5-file pass (one commit per file):**

| Commit | File | Before | After | Extracts |
|---|---|---:|---:|---|
| `8b2a8ee` | `app/club-ladder/page.tsx` | 1450 | 991 | `LadderContentView`, `LadderActivityView`, `utils/ladder.ts` |
| `3518fd3` | `app/tournaments/page.tsx` | 1093 | 811 | `TournamentCardView` |
| `eee0abf` | `app/my-challenges/page.tsx` | 909 | 686 | `MyChallengeCardsView`, `utils/challenges.ts` |
| `cda01af` | `app/match/[matchId]/page.tsx` | 694 | 607 | `ScoreSubmissionView` |
| `76854cc` | `app/games/page.tsx` | 659 | 550 | `CreateInviteView`, `utils/games.ts` |

**Flat rule (9.6):** a helper called from both the shell and the extracted view goes to its own file; a helper called from only one stays inline there.

### Phases 1–8

Reconstructed from merge artifacts — details to be fleshed out by whoever has the original session transcripts:

- Phase 1 — Supabase type generation (`lib/database.types.ts`, 1505 lines).
- Phase 2 — Admin gate consolidation (`lib/auth/adminGate.ts` + tests).
- Phase 3 — Tournament pure-helper extraction: `bracket`, `handicap`, `labels`, `match`, `teams`, `matchHelpers` in `lib/tournaments/` — each with a dedicated `.test.ts`.
- Phase 4 — API route hardening: `challenges/*`, `matches/*`, `tournaments/*`. **See deferral 4.4 below.**
- Phase 5 — Tournament batch RPCs: `supabase/migrations/20260422_tournament_batch_rpcs.sql`; new batch routes `app/api/tournaments/matches/{admin-final,bulk-save-scores,save-fixtures}/batch/route.ts`; legacy `app/tournaments/matches/{admin-final,confirm-score,submit-score}/route.ts` deleted. **See deferral 5.5 below.**
- Phase 6 — Shared UI primitives: `app/components/{PrimaryButton,ScoreInput,SectionCard,StatusPill}.tsx`.
- Phase 7 — Theme codemod (`scripts/theme-codemod.mjs` applied then deleted).
- Phase 8 — Vitest setup (`vitest.config.ts`, test files, 81 tests total).
- Phase 9 — Mega-file split (see above).

---

## Open deferrals (carry forward)

> **TODO for the owner picking this up:** the two deferrals below were agreed during the audit but their specifics are not captured in this handoff doc. Fill in the `<describe>` blanks from the original Phase 4 and Phase 5 session transcripts / plan files before anyone starts work.

### Deferral 4.4 — (from Phase 4)

Phase 4.4 — Deduplicate MatchRow / TournamentRow / TeamRow types against generated Database types (deferred).

Scope: Each page file (admin detail, public detail, admin index, public index, home) defines its own local TournamentRow, MatchRow, TeamRow. These are near-duplicates of Database["public"]["Tables"]["..."]["Row"]. Replace local definitions with imports from lib/tournaments/types.ts which re-exports the generated types.

Why deferred: The local types use narrow unions (status: "ANNOUNCED" | "IN_PLAY" | "COMPLETED") where the generated types have status: string. Every if (status === "ANNOUNCED") call site relies on this narrowing. Migrating requires adding the narrow unions as separate types in lib/tournaments/labels.ts (already partially present there) and using them alongside the row types at every call site. Estimated ~5 page files × ~10 call sites each = 50 sites. Mechanical but cross-cutting; deferred from Phase 4 to avoid regressing typecheck across the whole app mid-phase.

### Deferral 5.5 — (from Phase 5)

Phase 5.5 — Extract BracketTree component (deferred from Phase 5).

Scope: Lift the ~320-line knockout bracket render (currently duplicated between app/admin/tournaments/[id]/views/RoundsView.tsx and app/tournaments/[id]/views/BracketView.tsx) into a shared component at components/BracketTree.tsx. Migrate both call sites. Verify visual parity on mobile and desktop.

Why deferred: The render depends on ~15 locally-derived values (roundLayouts, cardW, cardH, colGap, headerOffset, width, height, lines, treeRoundRefs, roundPositions, slotLabel, winnerTeamIdFromMatch, roundLabel, etc.). Clean extraction requires either a large explicit-prop surface or a pre-computed BracketModel value object. The bracket geometry helpers (computeTreeLayout, computeBracketLines, treeSlotLabel) were already hoisted to lib/tournaments/matchHelpers.ts in Phase 9.3, which is the precondition for this work. Deferred to give full attention in a dedicated phase.

### Other carry-forwards

- **Push `main`:** merge is local only; not yet pushed to `origin/main`.
- **`app/club-ladder/page.tsx` still 991 lines:** the only shell remaining over 1000-ish. Further extraction was explicitly waived in Phase 9.6 — the remaining state (18 `useState`, 6 `useEffect`) is dense and no further split is low-risk. Revisit only if the file grows again.
- **Behavioural parity:** Phase 9 was pure relocation; no seeded interactive tests were run, only render + console-clean smoke. Any production regression that traces to Phase 9 should be caught against individual commits via `git revert`.

---

## Commit trail (Phase 9.5–9.6)

```
76854cc refactor(phase-9): split games page into shell + create invite view
cda01af refactor(phase-9): split match detail page into shell + score view
eee0abf refactor(phase-9): split my-challenges into shell + cards view
3518fd3 refactor(phase-9): split tournaments page into shell + card view
8b2a8ee refactor(phase-9): split club-ladder into shell + ladder/activity views
a36a570 refactor(phase-9): extract CreateTournamentModal from admin tournaments list
```

(Earlier commits for 9.1–9.4 and Phases 1–8 live on `refactor/audit-fixes` before `a36a570`.)

Each commit is independently revertable via `git revert <sha>`.

---

## Verification replay

```bash
npx tsc --noEmit        # expect 0 errors
npm test                # expect 81/81
npm run build           # expect 36 routes, 0 errors
```
