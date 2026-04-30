# DRIFT_TRIAGE_PHASE12.md

Generated: 2026-04-30
Branch: rebuild/phase-11-comms at 005b8af
Source: DRIFT_LOG.md (63 open entries)
Method: PM toolkit RICE — `RICE = (R × I × C) / E`. Anchors: R 1–10 weekly v1 user reach (cohort: ~720 members across 9 demo clubs); I ∈ {0.25, 0.5, 1, 2, 3}; C ∈ {0.5, 0.8, 1.0}; E in person-days (Claude Code).

**This file is a triage proposal, not a decision.** Read, override inline by editing the `Bucket` column, then we cut sub-checkpoints from the surviving MUST + NICE rows.

---

## Summary

| Bucket | Count | Definition |
|--------|-------|------------|
| **MUST** | 12 | Ships in Phase 12. v1 launch is incomplete without it. |
| **NICE** | 8 | Ships in Phase 12 if time allows. Real value but skippable. |
| **DROP** | 0 | Strike through in DRIFT_LOG. |
| **DEFER → Phase 13** | 18 | Re-tag owner-phase to Phase 13 (technical polish). |
| **DEFER → future / post-v1** | 15 | Re-tag owner-phase to "post-v1" or named future phase. |
| **REWORD** | 9 | Rewrite scope before classifying. See "Re-owner candidates" + "Consolidation candidates". |
| **PARKED (BLOCKED)** | 1 | Cannot proceed without external input; not blocking Phase 12 close. |
| **TOTAL** | **63** | ✓ |

**Bucketing rule used:** an entry is in exactly one bucket. Entries that need consolidation (e.g. L26+L27+L28) are bucketed at their post-merge classification with the merge instruction in the "Consolidation candidates" section. Entries that need owner re-tagging (e.g. L147, closed-phase reference) are bucketed at their post-rewrite classification with the rewrite instruction in the "Re-owner candidates" section. **REWORD is reserved for entries whose classification cannot be decided as-is** — either genuinely vague scope, or entries conflating two different fates that need to be split first.

---

## Triage table

Sorted by RICE descending within each bucket. RICE column reads `R/I/C/E = score`.

### MUST — Phase 12 scope

| ID | Line | Original owner | Headline | Sub-checkpoint | RICE | Rationale |
|----|------|----------------|----------|----------------|------|-----------|
| M1 | L166 | Phase 12 | Player-side `/t20` page never built | 12-1 | 8 / 3 / 1.0 / 1 = **24.0** | Closes a public marketing-page lie (`ShowcaseT20` advertises this view). Single biggest v1-credibility entry. All primitives exist. |
| M2 | L151 | Phase 12 | T20 results view: notes are read-only | 12-4 | 4 / 2 / 0.8 / 0.5 = **12.8** | Coaches can't add notes via UI today — major gap in the coach workflow that T20 is built around. Cheap action + inline edit. |
| M3 | L42 | Phase 12.5 | Phase 7 Lighthouse re-run vs real detail page | 12-5 | 3 / 1 / 1.0 / 0.25 = **12.0** | Original score measured against a 404 page; never re-run. Cheap and gives info needed for Phase 13 perf gate decision. |
| M4 | L67 | Phase 12.5 | Player route Performance scores below 90 (1.4MB chunk) | 12-5 | 9 / 2 / 0.8 / 1.5 = **9.6** | Every player session pays this cost; LCP 4.4s + TBT 1040ms on `/play`. Lead identified (lazy-load `BookingSheet` / `OpponentConfirmationCard` / `DisputeForm`; verify lucide tree-shake; gate `@react-pdf` + `dexie` from player chunks). |
| M5 | L168 | Phase 12 | Live recipient-count preview missing on `/manage/messages/new` | 12-3 | 3 / 1 / 0.8 / 0.25 = **9.6** | Pre-send confidence; avoids "I sent to nobody" surprises. `resolveAudienceCount` already exists — just wire it. |
| M6 | L174 | Phase 12 | Tournament ↔ greens link missing | 12-2 | 2 / 2 / 1.0 / 0.5 = **8.0** | Phase 7b promise dropped on submit. Migration + form wire. Pre-condition for any rink-fairness work. Pairs with M7. |
| M7 | L175 | Phase 12 | `tournaments.fair_rink` column missing | 12-2 | 2 / 1 / 1.0 / 0.25 = **8.0** | Same surface as M6 (Phase 7b create form). Trivial migration; ship in same commit. |
| M8 | L146 | Phase 12.5 | T20 New form: Save-as-draft button disabled | 12-4 | 2 / 1 / 1.0 / 0.25 = **8.0** | Disabled-CTA pattern. Decision: remove the button OR wire `saveAssessmentDraft` action. Either closes the v1 lie. |
| M9 | L167 | Phase 12 | Resend invite button missing in admin UI | 12-3 | 3 / 1 / 0.8 / 0.5 = **4.8** | Recovery path for `email_status='failed'` invites. Cheap (button + `resendInviteEmail` action; calls existing `sendInviteEmail`). |
| M10 | L150 | Phase 12.5 | T20 results: R1/R2 round splits are even-half presentation | 12-4 | 3 / 2 / 0.8 / 1 = **4.8** | Misleading data presentation in coach-facing report — current `Math.round(total/2)` per row is a stand-in. Coach reading whether a player improved between R1 and R2 within a section gets fake 50/50 numbers. Plumb `round` through `aggregateAssessment`. |
| M11 | L169 | Phase 12 | No edit page for existing message drafts | 12-3 | 2 / 1 / 1.0 / 0.5 = **4.0** | Drafts are write-once today. Server foundation already in place; copy `/manage/messages/new` to `[id]/edit/page.tsx`, swap action wire-up. |
| M12 | L176 | Phase 12 | Tournament drafts not implemented (Save-as-draft disabled) | 12-2 | 2 / 2 / 0.8 / 1 = **3.2** | Same disabled-CTA pattern as M8. Decision: remove button OR ship `saveTournamentDraft` action + draft list-page surface. `tournament_status` enum already has `'draft'`. |

### NICE — Phase 12 scope if time allows

| ID | Line | Original owner | Headline | Sub-checkpoint | RICE | Rationale |
|----|------|----------------|----------|----------------|------|-----------|
| N1 | L36 | Phase 12.5 | Hero pocket highlight ~2% hex drift | 12-6 | 5 / 0.25 / 1.0 / 0.1 = **12.5** | Cosmetic. Folds into the design fidelity sweep for free; ~2-line edit. Standalone-effort wouldn't justify it. |
| N2 | L26 | Phase 12.5 | T20 compass card — wedge labels missing | 12-6 | 5 / 1 / 1.0 / 0.5 = **10.0** | One of three compass-card design-fidelity sub-bullets. Consolidate L26+L27+L28 into a single drift entry first (see Consolidation candidates). Single fix session covers all three. |
| N3 | L27 | Phase 12.5 | T20 compass card — grade legend wording drifted | 12-6 | (consolidate with N2) | BSA-aligned wording lost. Same fix session as N2. |
| N4 | L28 | Phase 12.5 | T20 compass card — metadata drifted | 12-6 | (consolidate with N2) | Same surface; same commit. |
| N5 | L34 | Phase 12.5 | Auth Checkbox arbitrary variant — replace with shadcn primitive | 12-6 | 3 / 0.5 / 1.0 / 0.25 = **6.0** | Quick refactor; closes a known shadcn primitive bypass. Fits the design fidelity sweep. |
| N6 | L154 | Phase 12.5 | Rubrics page: drop YAML mention from upload-zone copy | 12-6 | 1 / 0.25 / 1.0 / 0.1 = **2.5** | Reframed from "support YAML upload" to "drop the YAML mention from copy" per the entry's own alt fix. ~2-line edit; closes the entry without adding a parser dep. |
| N7 | L145 | Phase 12 | T20 list page: Export CSV button not wired | 12-4 | 2 / 1 / 0.8 / 0.5 = **3.2** | Promised UI button. Decision: remove button (0.1d) OR build CSV endpoint (1d). Coach utility; modest reach. |
| N8 | L152 | Phase 12 | T20 results: coach-categorised notes (Strengths/Watch/Focus) | 12-4 | 4 / 1 / 0.8 / 1 = **3.2** | UX richness on coach reports. Depends on M2 landing first (single-column edit before splitting). Schema decision: separate columns vs `notes jsonb`. |

### DEFER → Phase 13 (technical polish)

| ID | Line | Original owner | Headline | RICE | Rationale |
|----|------|----------------|----------|------|-----------|
| D1 | L41 | Phase 13 | `profile_id` vs `auth.users.id` confusion in joined queries (audit) | 5 / 1 / 0.8 / 1 = **4.0** | Already correctly owned. Class-of-bug audit; bit twice. |
| D2 | L43 | Phase 13 | PostgREST embed audit across `_data.ts` files | 5 / 1 / 0.8 / 1 = **4.0** | Already correctly owned. Two-pattern repeat — needs grep + cross-check vs `database.types.ts`. |
| D3 | L57 | Phase 13 | State-machine-vs-surface audit (state×surface matrix) | 5 / 2 / 0.8 / 2 = **4.0** | Already correctly owned. Burned 5 fix rounds in Phase 8d on this pattern. |
| D4 | L181 | Phase 13 | tz-naive date formatters across pre-Phase-7 surfaces | 4 / 0.5 / 1.0 / 0.5 = **4.0** | Already correctly owned. Five known sites; helper exists at `lib/format/dates.ts`. |
| D5 | L55 | Phase 13 | Two-commit rule for schema-dependent application changes | 1 / 1 / 1.0 / 0.25 = **4.0** | Already correctly owned. Process audit — codify in `phase-discipline` skill. Quick edit; do at Phase 13 open. |
| D6 | L64 | Phase 13 | Server-only module poisoning risk audit | 4 / 1 / 0.8 / 1 = **3.2** | Already correctly owned. Sweep + lint rule candidate. |
| D7 | L190 | Phase 13 | `"use client"` constant-taint sweep | 4 / 1 / 0.8 / 1 = **3.2** | Already correctly owned. Same flavour as D6; could batch. |
| D8 | L65 | Phase 13 | RLS test cleanup hardening — orphan rows from ON DELETE RESTRICT | 3 / 0.5 / 1.0 / 0.5 = **3.0** | Already correctly owned. Test-debt cleanup. |
| D9 | L187 | Phase 13 | `vitest.rls.config.ts` covers non-RLS tests (rename) | 1 / 0.25 / 1.0 / 0.1 = **2.5** | Already correctly owned. Trivial rename + script update. |
| D10 | L52 | Phase 13 | Mocked-Supabase action tests bypass RLS — class-of-bug | 5 / 1 / 0.8 / 2 = **2.0** | Already correctly owned. Sweep all action-layer tests; ensure each protected mutation has a real-RLS integration test. |
| D11 | L183 | Phase 13 | §18 documentation drift — `bracket.ts` content vs §18 mapping | 1 / 0.5 / 1.0 / 0.25 = **2.0** | Already correctly owned. Plan reconciliation line edit. |
| D12 | L184 | Phase 13 | Vitest Windows worker-pool flake (`--fileParallelism=false` pin) | 2 / 0.5 / 0.5 / 0.25 = **2.0** | Already correctly owned. Waits on upstream Vitest fix. |
| D13 | L186 | Phase 13 | Supabase local Storage healthcheck flake on WSL2 | 2 / 0.5 / 0.5 / 0.25 = **2.0** | Already correctly owned. Waits on Supabase CLI healthcheck timeout config. |
| D14 | L188 | Phase 13 | TanStack Table + Virtual + React Compiler lint warnings | 4 / 0.25 / 0.5 / 0.25 = **2.0** | Already correctly owned. Waits on TanStack compiler-friendly API. |
| D15 | L189 | Phase 13 | Playwright prod server slow on Windows | 2 / 0.5 / 0.5 / 0.25 = **2.0** | Already correctly owned. Waits on Next 16 Windows cold-start fix or CI move to Linux. |
| D16 | L142 | Phase 12.5 | `activateRubricVersion` is sequential UPDATE+UPDATE not RPC | 1 / 0.5 / 1.0 / 0.5 = **1.0** | Re-own to Phase 13. Race window sub-millisecond, super-admin-only, infrequent. RPC promotion is established pattern but not v1-blocking. |
| D17 | L40 | Phase 13 | Hydration mismatch on TournamentsList with junk URL params | 2 / 0.25 / 0.8 / 0.5 = **0.8** | Already correctly owned. Cosmetic warning; page works. |
| D18 | L44 | Phase 12 | Tournament detail RPC consolidation | 2 / 0.5 / 0.8 / 1.5 = **0.5** | Re-own to Phase 13. Robustness only; current works. Defer unless re-breaks. |

### DEFER → future / post-v1

| ID | Line | Original owner | Headline | RICE | Rationale |
|----|------|----------------|----------|------|-----------|
| F1 | L173 | Phase 12 | Feeder `match_no` displayed via hash fallback in DrawTab | 3 / 0.5 / 0.8 / 0.5 = **2.4** | Cosmetic. "Winner of M##" hash works visually; no v1 user reports this as wrong. |
| F2 | L54 | Phase 12 | Mark peel vs Skip differentiation in `match_ends` | 3 / 0.5 / 0.8 / 0.5 = **2.4** | Domain semantic correctness; both buttons currently write 0/0 rows. Invisible to v1 user; matters for match audit trail later. |
| F3 | L144 | Phase 12.5 | T20 list page: filter state React-local not URL-driven | 2 / 0.5 / 1.0 / 0.5 = **2.0** | Shareable URLs nice but not essential for single-coach workflows. |
| F4 | L35 | Phase 12.5 | SpeckleField per-instance seed missing | 2 / 0.25 / 1.0 / 0.25 = **2.0** | Not currently triggered; tech debt only. |
| F5 | L141 | Phase 12 | `addSecondMarker` writes composite "Name · ACCRED" — split column | 2 / 0.5 / 0.8 / 0.5 = **1.6** | Schema cleanliness; both values persist concatenated; display works fine. |
| F6 | L143 | Phase 12.5 | T20 list page: coach-no-captures empty state not implemented | 2 / 0.5 / 0.8 / 0.5 = **1.6** | State unreachable today (no assessor filter). Build when scoping lands. |
| F7 | L60 | Phase 12.5 | Fair-Rink hints — soft-deprioritisation algorithm | 4 / 1 / 0.5 / 2 = **1.0** | Algorithm-research-heavy; design-research-heavy per entry text. Not v1-blocking — current UI shows all rinks equally. |
| F8 | L58 | Phase 12.5 | Admin per-match Submissions drill-down modal | 2 / 1 / 0.8 / 1.5 = **1.1** | Admin UX richness; bulk-only flow today. Defer until bulk-only becomes a friction point. |
| F9 | L147 | Phase 12.5 | T20 capture wizard: distance-bucket capture not surfaced | 2 / 0.5 / 0.8 / 1 = **0.8** | Column nullable; v1 stays nullable until v2 rubric activates. Wait on v2 rubric authoring. |
| F10 | L155 | Phase 12.5 | Rubrics page: View schema modal not implemented | 1 / 0.5 / 0.8 / 0.5 = **0.8** | Super-admin can read `lib/t20/rubric.ts` directly today; modal is convenience. |
| F11 | L149 | (orphan) | T20 results view: PDF template not implemented | 3 / 2 / 0.5 / 3 = **1.0** | Per entry: "PDF template's visual polish is out of scope for Phase 10." Stays out of Phase 12 too — needs Claude Design follow-up session. UI surfaces toast placeholder. |
| F12 | L148 | Phase 12.5 | T20 capture wizard: no Cancel-with-confirmation dialog | 2 / 0.25 / 0.5 / 0.5 = **0.5** | Per-tap autosave; no discard-changes path needed. Revisit after coach field-testing feedback. |
| F13 | L62 | Phase 12.5 | Audit-log fetcher 500-row pre-fetch cap | 1 / 0.25 / 0.5 / 1 = **0.13** | Cap is fine for v1 per entry. Real bite would surface as user complaint. |
| F14 | L63 | Phase 12 | Audit-log read flagged generically when audit fetch fails | 1 / 0.25 / 0.5 / 1 = **0.13** | Telemetry tier decision pending; observability-stack-dependent. |
| F15 | L156 | (orphan) | Rubrics page: Export changelog button disabled | 1 / 0.5 / 0.5 / 0.5 = **0.5** | Same blocker as F11 (PDF template work). Consolidate with F11 in DRIFT_LOG (see Consolidation candidates), then defer alongside it. |

### REWORD — rewrite scope before classifying

These 9 entries cannot be classified as-is. Either the scope is genuinely vague (no concrete trigger), or one entry conflates two different fates that need to be split. After the rewrite is applied (in DRIFT_LOG), each gets a clear bucket per the proposal column below.

| ID | Line | Original owner | Headline | Suggested rewrite | Bucket after rewrite |
|----|------|----------------|----------|-------------------|----------------------|
| R1 | L29 | Phase 12.5 | Top nav system — pill vs text-links | **Add a verification step**: confirm whether shipped text-links nav was a deliberate v1 redesign during marketing surface work, or a deferred drift. | DROP if deliberate / NICE → 12-6 if drift |
| R2 | L30 | Phase 12.5 | Hero heading wording | Same as R1 — likely deliberate during marketing pass. Verify with the design source. | DROP if deliberate / NICE → 12-6 if drift |
| R3 | L61 | Phase 12 | Tournament `AuditTab` retrofit | **Split into two entries**: (a) copy fix on AuditTab empty state — replace stale "audit_log table lands in Phase 12" copy; (b) full retrofit (helper extension + RPCs + tab wire). | (a) MUST → 12-2 (~0.1d); (b) DEFER → Phase 13 |
| R4 | L66 | Phase 8g + Phase 12.5 | Lighthouse PWA category removed in v12+ | **Split into two entries**: (a) spec-edit half — rewrite the rebuild plan's PWA gates in `HANDIBOWLS_REBUILD_PLAN.md:481, 715, 989, 1081` to reference structural checks (manifest validates / SW registered / PWA-required icons exist / apple-touch-icon emitted / `beforeinstallprompt` fires on real device); (b) Lighthouse-11 pinning question. | (a) MUST → 12-7 (plan reconciliation, ~0.25d); (b) DROP (Lighthouse 11 is EOL, pinning isn't a real path) |
| R5 | L136 | Phase 7 (STALE) | `closeEntries` gate semantics — Phase 7 mirror | **Re-own to Phase 12 verification step**: confirm admin UI gates on `(status='open' AND (entries_close_at IS NULL OR entries_close_at > now()))`. Likely already implemented in Phase 7 — verify on disk before deciding whether to add inline fix or close as already-shipped. | MUST → 12-2 (verification only; effort = 0.1d if already shipped) |
| R6 | L153 | Phase 12.5 | T20 results: "Schedule next" button dropped | **Consolidate with R7 (L170)**: same dispatcher dependency. Defer the button alongside the dispatcher. | DEFER → future (post-v1, alongside L170) |
| R7 | L170 | future | Scheduled-send dispatcher not built | **Consolidate with R6 (L153) + split**: (a) remove "Send later" option from `/manage/messages/new` compose form for v1 (avoids the lie that nothing dispatches when the timestamp elapses); (b) build scheduled-send dispatcher (hosting decision pending: Vercel cron / pg_cron / external scheduler). | (a) MUST → 12-3 (~0.25d); (b) DEFER → future |
| R8 | L171 | (parked) | PlayerBottomNav `"20/20"` compact-form exception | **Reclassify as Decisions doc-only entry**. Move under a new "Decisions" sub-section in DRIFT_LOG, alongside L48 AdminSidebar foot-card contract. Already documented inline + pinned by test + codified in `bsa-terminology` skill. No follow-up work; entry exists for audit trail only. | RECLASSIFIED (open-list count drops by 1) |
| R9 | L182 | Phase 13 | AdminSidebar duplication across branches | **Reclassify as Decisions doc-only entry** (alongside R8). Entry text says "No reconcile work expected." Move to Decisions sub-section. | RECLASSIFIED (open-list count drops by 1) |

### PARKED (BLOCKED)

| ID | Line | Original owner | Headline | Status |
|----|------|----------------|----------|--------|
| P1 | L177 | Phase 12 | BSA seeding algorithm details unverified | **PARKED — does not block Phase 12 close.** Add `[BLOCKED: coach input pending]` flag in DRIFT_LOG. The moment a BSA-accredited coach is available for review, lands in whichever sub-checkpoint is open at the time. Pre-condition for any future seeding-algorithm change. |

---

## Consolidation candidates

Pre-Phase-12-build cleanup of DRIFT_LOG itself. Apply these merges before any sub-checkpoint cuts code so the log reflects the post-triage shape.

1. **L26 + L27 + L28 → single entry "T20 compass card design fidelity"** with three sub-bullets:
   - Wedge labels (N/NE/E/SE/S/SW/W/NW + A/B/C/D grades) missing
   - Grade legend wording drifted from BSA-aligned copy
   - Metadata strings drifted (`STATION 3 · DRAW TO JACK` vs `BSA T20 · DRAW SHOT`; `END 4 OF 6` vs `END 4 OF 20`; running percentage missing)

2. **L174 + L175 → single entry "Phase 7b cross-cutting tournament migration"** covering:
   - `tournament_greens` join table (tournament_id + green_id, composite PK)
   - `tournaments.fair_rink boolean not null default true` column
   - Form wire-up on `/manage/tournaments/new` for both fields

3. **L153 + L170 → single entry "Scheduled-send infrastructure (deferred)"** covering both the messaging dispatcher and the T20 "Schedule next" button. Both wait on the same hosting decision.

4. **L149 + L156 → single entry "PDF template + changelog export"** — same Claude Design follow-up dependency.

---

## Re-owner candidates

Entries whose owner-phase tag in DRIFT_LOG must be rewritten before Phase 12 build starts. (Distinct from REWORD entries above, which need scope rewrites; these only need the owner field updated.)

| Line | Current owner | Rewrite to |
|------|---------------|------------|
| L136 | Phase 7 (STALE — closed) | Phase 12 — verification step (confirm gate already implemented in Phase 7 admin UI, then close). See R6 above. |
| L66 | Phase 8g + Phase 12.5 | Phase 12 plan reconciliation (spec-edit half) + drop the Lighthouse-11 pinning sub-task. See R5. |
| L147 | Phase 10 follow-up + Phase 12.5 | Phase 12.5 only (drop Phase 10 reference; Phase 10 closed). See R7. |
| L171 | "design-pass-when-it-comes" | **Move to Decisions sub-section** of DRIFT_LOG (doc-only entry, alongside L48 AdminSidebar foot-card contract). See R11. |
| L182 | Phase 13 | **Move to Decisions sub-section** of DRIFT_LOG (entry says "No reconcile work expected"). See R12. |
| L44 | Phase 12 | Phase 13. See D18. |
| L142 | Phase 12.5 | Phase 13. See D16. |
| L177 | Phase 12 | Phase 12 — **PARKED** flag added (`[BLOCKED: coach input pending]`). See P1. |

---

## Recommended Phase 12 sub-checkpoint structure

7 sub-checkpoints. Grouped by surface cluster (not entry order). Each lands as one or more atomic commits per `handibowls-standards`. RICE totals exclude REWORD entries (rescore after rewrite).

### 12-1 — Player-side completeness
**Estimated effort: ~1 person-day**
**Surfaces:** `app/(player)/(gated)/t20/`, `components/t20/`

| Entry | Bucket | Effort |
|-------|--------|--------|
| M1 — L166 Player `/t20` page | MUST | 1.0 |

Single sub-checkpoint per the entry text ("1 sub-checkpoint, ~half a day"). Add 0.5d safety because design integration (frame 06: Silver tier card, Book Gold Assessment CTA) often surfaces edge cases.

### 12-2 — Tournament admin gaps
**Estimated effort: ~2 person-days**
**Surfaces:** `app/(club-admin)/manage/tournaments/`, `supabase/migrations/`

| Entry | Bucket | Effort |
|-------|--------|--------|
| M6 + M7 — L174 + L175 (consolidated) Tournament↔greens link + fair_rink | MUST | 0.75 |
| M12 — L176 Tournament drafts | MUST | 1.0 |
| R3(a) — L61 AuditTab empty-state copy fix | MUST (REWORD-derived) | 0.1 |
| R5 — L136 closeEntries gate verification | MUST (REWORD-derived) | 0.25 |

Two-commit minimum per `handibowls-standards`: migration commits land first, application code second.

### 12-3 — Messaging admin polish
**Estimated effort: ~1.5 person-days**
**Surfaces:** `app/(club-admin)/manage/messages/`, `app/(club-admin)/manage/members/`, `app/(super-admin)/platform/clubs/[id]/`

| Entry | Bucket | Effort |
|-------|--------|--------|
| M5 — L168 Live recipient-count preview | MUST | 0.25 |
| M9 — L167 Resend invite button | MUST | 0.5 |
| M11 — L169 Edit page for message drafts | MUST | 0.5 |
| R7(a) — L170 Remove "Send later" option from compose form | MUST (REWORD-derived) | 0.25 |

### 12-4 — T20 admin polish
**Estimated effort: ~2 person-days**
**Surfaces:** `app/(club-admin)/manage/t20/`, `lib/t20/`

| Entry | Bucket | Effort |
|-------|--------|--------|
| M2 — L151 Notes editable (`editAssessmentNotes` action) | MUST | 0.5 |
| M10 — L150 R1/R2 round splits — engine-derived | MUST | 1.0 |
| M8 — L146 Save-as-draft button (remove or wire) | MUST | 0.25 |
| N7 — L145 Export CSV (remove or build) | NICE | 0.5 |
| N8 — L152 Coach-categorised notes | NICE (depends on M2) | 1.0 |

### 12-5 — Performance + Lighthouse sweep
**Estimated effort: ~2 person-days**
**Surfaces:** `app/(player)/(gated)/`, bundle analysis

| Entry | Bucket | Effort |
|-------|--------|--------|
| M3 — L42 Phase 7 Lighthouse re-run | MUST | 0.25 |
| M4 — L67 Player route Performance scores < 90 | MUST | 1.5 |

`@next/bundle-analyzer` first to confirm the 1.4MB chunk's contents; lazy-load three sheet/modal Client Components; verify `lucide-react` tree-shaking; gate `@react-pdf` + `dexie` from player chunks; audit `next/font` for `Barlow Condensed Italic Black 900`. Re-record per-surface scores in PHASE_LOG.

### 12-6 — Design fidelity sweep (12.5 stream)
**Estimated effort: ~1.5 person-days**
**Surfaces:** `app/page.tsx`, `app/(marketing)/_sections/`, `app/(auth)/`, `app/(super-admin)/platform/t20/rubrics/`

| Entry | Bucket | Effort |
|-------|--------|--------|
| N1 — L36 Hero pocket highlight hex | NICE | 0.1 |
| N2+N3+N4 — L26+L27+L28 (consolidated) T20 compass card | NICE | 0.5 |
| N5 — L34 Auth Checkbox shadcn primitive | NICE | 0.25 |
| N6 — L154 Drop YAML mention from rubric copy | NICE | 0.1 |
| R1 + R2 — L29 + L30 nav + hero copy verification | NICE if confirmed drift | 0.25 |

If R1/R2 verification reveals these were deliberate marketing-pass changes, drop both and skip the time.

### 12-7 — Pre-stakeholder QA + Phase 12 close
**Estimated effort: ~1 person-day**

Manual walkthrough of every surface against the `handibowls/project/*.jsx` design sources (precedent: Phase 8c scoring grid drift, closed at Phase 8d). Document any new drift in DRIFT_LOG with same-session triage (MUST → fold into a 12-final commit; NICE → DEFER → Phase 13; DROP → strike).

| Step | Effort |
|------|--------|
| R4(a) — L66 plan reconciliation: rewrite Lighthouse PWA gates in `HANDIBOWLS_REBUILD_PLAN.md` | 0.25 |
| Pre-stakeholder QA walkthrough | 0.5 |
| Drift sweep (open/closed counts; entries this phase changed; consolidations applied) | 0.1 |
| PHASE_LOG entry + README update | 0.15 |
| 12-final fixes if QA surfaces any | 0–? (open buffer) |
| Decisions section reorganisation in DRIFT_LOG (R8 + R9 — L171 + L182) | 0.1 |

---

## Estimated total Phase 12 effort

| Sub-checkpoint | Effort (person-days) |
|----------------|----------------------|
| 12-1 Player-side completeness | 1.0 |
| 12-2 Tournament admin gaps | 2.0 |
| 12-3 Messaging admin polish | 1.5 |
| 12-4 T20 admin polish | 3.25 (with both NICE) |
| 12-5 Performance + Lighthouse sweep | 1.75 |
| 12-6 Design fidelity sweep | 1.2 |
| 12-7 Pre-stakeholder QA + close | 1.1 |
| **Total** | **~11.8 person-days** (without NICE drops); ~10.3 dropping N7 + N8 if pressed |

Add ~20% buffer for unexpected drift surfaced during 12-7 QA walkthrough → **realistic floor ~14 person-days, ceiling ~16**.

---

## Override workflow

1. Read this file end-to-end.
2. Edit the `Bucket` column in any row where you disagree.
3. For REWORD rows: edit the "Suggested rewrite" column with your preferred wording, or replace it with `[KEEP AS-IS]` to skip the rewrite.
4. For consolidation candidates: strike through any group you don't want merged.
5. For sub-checkpoint structure: re-cluster entries between sub-checkpoints, or split/merge sub-checkpoints.
6. Drop a one-line summary at the bottom of this file under "## Override summary" so the next session sees what changed without diffing.
7. When done, ping back. Surviving MUST + NICE entries become Phase 12's actual scope; the file gets committed alongside the first sub-checkpoint commit per the audit-trail decision.

---

## Override summary

_(empty — pending review)_
