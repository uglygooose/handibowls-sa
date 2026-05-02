# Phase 13 / 13-3 — Perf + Visual Residuals + Cross-cutting Refactor Scoping Report

Captured: 2026-05-03
Branch tip at audit: `44b4a74`
Methodology: 3 parallel `Explore` subagent runs (entries 2 / 4 / 6 — wide-grep
work) + main-thread reads (entries 1 / 3 / 5 — focused multi-file work).

This report scopes the 6 entries pulled into Phase 13 / 13-3 from 13-1
carry-forwards + 13-2a/b cross-cutting + native 13-3 polish. No code
changes, no migrations, no DRIFT entries opened or closed.

---

## 1. Per-entry classification

### Entry 1 — `sw-registration-missing`

| Aspect | Value |
|---|---|
| Type | **NEW-COMPONENT** |
| Scope | **S** (≤30 LOC; single mount point + 1-line client-component import) |
| Dependencies | None — `app/sw.ts` already ships (86 LOC), `@serwist/next` 9.5.7 + `@serwist/turbopack` 9.5.7 are in `package.json`, `next.config.ts` already wraps with `withSerwist` |
| Risk | **Low** — Serwist's `<SerwistProvider>` is a battle-tested helper; default behaviour matches the locked offline-first contract; no schema / RLS / data-layer surface |
| Decision needed | **No** — the API is documented (`SerwistProvider({ swUrl="/sw.js", register=true, cacheOnNavigation=true, reloadOnOnline=true })`) |

`@serwist/next` ships `<SerwistProvider>` (`node_modules/@serwist/next/dist/index.react.d.ts`) — a Client Component that calls `window.serwist.register()` on mount when `register=true` (the default). Mounting it once at the root or player layout is the entire fix.

### Entry 2 — `text-ink-muted-token-contrast`

| Aspect | Value |
|---|---|
| Type | **FIX** (1-line token bump) **with audit overhead** |
| Scope | **S** for the bump; could escalate to M if Tier 2 visual regression review surfaces fixes |
| Dependencies | **Diagnostic anomaly to resolve first** (see below) |
| Risk | **Medium** (per subagent A) — 521 consumer sites across `app/` + `components/`; aggregate visual blast radius is app-wide |
| Decision needed | **Yes — diagnostic + target value** |

**Diagnostic anomaly surfaced during scoping (not in the original DRIFT entry).**

Subagent A found `--ink-muted: #4a4a4a` at `app/globals.css:140` — currently shipped value. Computes to ~9.0:1 on bone (#FAFAF8) and ~9.5:1 on white. **That already PASSES WCAG AA 4.5:1 by a wide margin.**

But the M3 residual-sweep axe baseline (`docs/audit/phase-13/baseline-13-1-m3-residual-sweep.json`) reports the failing party-meta foreground as `#90908f` on `#fdfdfc`, computing 3.13:1. The DRIFT entry said `#90908f` was the token value.

`git log -p -S "ink-muted" -- app/globals.css` shows the token has been `#4a4a4a` since the file existed (no commits ever changed `--ink-muted`; only `--ink-subtle` was bumped at Tier A commit 1 d529c74). No opacity modifiers found in source (`grep "text-ink-muted/"` returns zero hits in `app/` + `components/`).

**Possible causes (none confirmed during scoping):**
- (a) The Vercel preview build at residual-sweep capture (deployment `dpl_9MaRfdJHBRUdYGM7RvDC5nTywPCf`, SHA `dd5dbfc`) served a CSS bundle with a different value due to CDN/build-cache quirks.
- (b) Some downstream CSS rule overrides `.text-ink-muted` colour with a lighter value (e.g. a prose plugin, or a theme override block we missed).
- (c) Browser-side CSS computation in the captured Lighthouse run resolved the variable chain (`--color-ink-muted: var(--ink-muted)` → `--muted-foreground: var(--ink-muted)`) into a different effective value.

**Decision needed before any execution:** re-run the axe walker against a fresh Vercel preview build of `44b4a74` and confirm the actual rendered colour. If it's still `#90908f`, the diagnostic must complete before any token bump (otherwise we'd bump a token that doesn't render where the entry claimed). If it's `#4a4a4a` cleanly passing, the entry can be closed as audit-already-resolved without code changes.

If a bump IS needed (rendered colour confirmed as failing), subagent A's recommendation of **`#303030`** clears 4.5:1 with margin on bone + surface + surface-muted; one-line change.

### Entry 3 — `t20-hero-eyebrow-theme-coupling`

| Aspect | Value |
|---|---|
| Type | **FIX** |
| Scope | **S** (1 line at `app/(player)/(gated)/t20/page.tsx:89`) |
| Dependencies | None — same pattern as Phase 13 / 13-1 / commit 12-fixup-2 (which fixed line 102) |
| Risk | **Low** — `text-[color:var(--color-on-primary)]` is the established theme-aware pattern, used elsewhere in the same file |
| Decision needed | **No** — replacement form is locked precedent |

Line 89 (verified): `<span className="mt-2.5 block font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-white/85">`. Drops the `/85` opacity + replaces hardcoded `text-white` with `text-[color:var(--color-on-primary)]` (theme-aware: white on dark themes, dark on sunburst / white-speckle).

### Entry 4 — `hover-pseudo-state-contrast-audit`

| Aspect | Value |
|---|---|
| Type | **FIX** (3 confirmed-fail hits + audit-pinned safe count) |
| Scope | **S** (~5 line diff total, 3 file edits) |
| Dependencies | None |
| Risk | **Low** — same atomic fix pattern as Phase 13 / 13-1 / commit 12 tinted-pill sweep; subagent B classified zero AMBIGUOUS hits |
| Decision needed | **No** — fix template (replace `text-{tone}-{N}` with `text-ink`) is locked precedent |

Subagent B grep'd 149 total `hover:bg-` occurrences across `app/` + `components/`, classified 9 as tinted-bg patterns, and found exactly 3 CONFIRMED-FAIL hits — the 3 named files in the DRIFT entry, no additional ones. The remaining 146 hover-bg patterns are CONFIRMED-SAFE (default state is solid bg; `text-on-primary` foregrounds; `text-ink` foregrounds; etc.).

### Entry 5 — L67-followup perf portion

| Aspect | Value |
|---|---|
| Type | **MEASUREMENT + targeted FIX** |
| Scope | M to L depending on real-device numbers |
| Dependencies | **Should land LAST in 13-3** so visual changes from entries 1-4 + 6 are baked in before perf baseline |
| Risk | **High** — perf scores below 90 today on every player route in WSL; real-device measurement may also miss the bar; remediation can cascade |
| Decision needed | **Yes — measurement vehicle + close-gate threshold** |

`scripts/baseline-13-1.mjs` ships a Lighthouse + axe walker that captured the M3 residual-sweep baseline (mobile preset for player routes, desktop for admin). Most-recent perf scores from `docs/audit/phase-13/baseline-13-1-m3-residual-sweep.md`:

| Surface | LH perf |
|---|---:|
| / | 69 |
| /login | 78 |
| /play | 64 |
| /tournaments/[id] | 80 |
| /t20 | 66 |
| /me | 70 |
| /manage | 43 |
| /manage/tournaments/[id] (L67) | 41 |
| /manage/members | 33 |
| /platform/clubs | 38 |

WSL Lighthouse noise is documented (locked decision: real-device or Vercel preview is canonical). Plan §16 step 1 sets the target: Performance ≥ 90.

### Entry 6 — `rounded-xl-tier-sweep`

| Aspect | Value |
|---|---|
| Type | **REFACTOR** (mechanical) |
| Scope | **L** (181 callers per subagent C; ~70% mechanical 1-to-1, ~30% per-call visual judgment) |
| Dependencies | None blocking |
| Risk | **Medium-high** visual blast radius (border-radius is customer-facing app-wide) |
| Decision needed | **Yes — canonical replacement + commit shape** |

Subagent C confirmed the canonical tier at `app/globals.css:103-109`:
```
--radius-sm  ~3.75px   --radius-md   ~5px
--radius-lg  10px      --radius-xl   14px
--radius-2xl 18px      --radius-3xl  22px   --radius-4xl 26px
```
Tailwind's default `rounded-xl` is **0.75rem = 12px**, OFF-tier. The canonical scale is **10 / 14 / 18 / 22 / 26px**.

Spot-check across 10 representative call sites suggests:
- ~70% should snap to **`rounded-[14px]`** (warm spacious card containers — quick-action tiles, tournament cards, inbox items, settings sub-route Cards)
- ~30% should snap to **`rounded-[10px]`** (compact form inputs / button grids — score inputs in DisputeForm, scorecard end-button rows)

**Other off-tier siblings** also present (NOT in scope per the DRIFT entry but worth flagging):
- 123 `rounded-md` (6px Tailwind default vs 5px canonical)
- 113 `rounded-lg` (8px Tailwind default vs 10px canonical) — most are shadcn primitives (Button / Input / etc.); deferred to post-v1 per the entry notes
- 42 `rounded-2xl` (16px Tailwind default vs 18px canonical)

`rounded-xl` is the single largest off-tier mismatch and is the only one in 13-3 scope.

---

## 2. Code reads required (per entry)

| Entry | Files / paths |
|---|---|
| 1 | `app/layout.tsx` (root mount), `node_modules/@serwist/next/dist/index.react.d.ts` (helper API), `app/sw.ts` (target SW URL: `/sw.js` per the registration default), `next.config.ts` (existing wiring) — **all read during scoping; no surprises** |
| 2 | `app/globals.css:140` (token def), 521 consumer sites across `app/` + `components/` — **read; diagnostic anomaly flagged** |
| 3 | `app/(player)/(gated)/t20/page.tsx:89` (target line) — **read; replacement form known** |
| 4 | `RinkDisableToggle.tsx:129-130`, `OpponentConfirmationCard.tsx:76` + 146 other `hover:bg-` sites — **read by subagent B; 3 CONFIRMED-FAIL, 0 AMBIGUOUS** |
| 5 | `scripts/baseline-13-1.mjs`, `docs/audit/phase-13/baseline-13-1-m3-residual-sweep.{md,json}` — **read; existing tooling adequate** |
| 6 | `app/globals.css:103-109` (canonical tier), 181 `rounded-xl` call sites + 10 spot-checked — **read by subagent C; tier mapping clear** |

---

## 3. Cross-cutting concerns

**Token tightening (#2) and theme-coupling (#3) overlap.** Both touch theme tokens. Entry 2 is `--ink-muted` (theme-invariant per scoping); Entry 3 is `text-white/85` which gets fixed via `--color-on-primary` (theme-aware, multiple per-theme overrides). They share a "theme contrast" thematic affinity but operate at different layers. **Recommend: separate batches** — Entry 3 is 1-line, can ship anywhere; Entry 2 needs the diagnostic resolution first. Bundling them creates cross-batch dependency that doesn't exist organically.

**Hover audit (#4) and rounded-xl sweep (#6) are both cross-cutting refactors.** Same discipline (grep + replace + visual verify) but different concern types and very different scope (5 LOC vs 181 LOC). **Recommend: separate batches** — 4 is small + clean and finishes the 13-1 a11y thread cleanly; 6 is the big mechanical sweep with larger visual blast radius. Different review effort levels.

**Perf measurement (#5) goes LAST** so all visual changes from #1-4 + #6 are baked into the production build before the canonical Lighthouse run. CLS / LCP / FCP could shift slightly with `<SerwistProvider>` mount + 181 border-radius changes; measuring before all UI work is in is wasted run.

**Operator-side Supabase rate-limit verification** (Batch A § A7 carry) is OUT OF 13-3 scope per the brief — banked for 13-7 launch checklist.

**B-from-F finding** (admins-without-club_memberships invisible to player views) is OUT OF 13-3 scope per 13-2b close — owner Phase 14.

---

## 4. Proposed batch structure

| Batch | Title | Type | LOC est | Commits est | Dependencies |
|---|---|---|---:|---:|---|
| **I** | `sw-registration-missing` — mount `<SerwistProvider>` | NEW-COMPONENT | ~10 | 1 | None |
| **J** | Hover-state contrast — 3 CONFIRMED-FAIL fixes (entry #4) + small `t20-hero-eyebrow` fix (entry #3) | FIX | ~7 | 1 | None |
| **K** | `text-ink-muted-token-contrast` — diagnostic + fix (entry #2) | DIAGNOSTIC + FIX | 1–15 | 1 | Diagnostic anomaly resolved first |
| **L** | `rounded-xl` 181-caller tier sweep | REFACTOR | ~181 | 1 (split if past 250 visual-judgment LOC) | None |
| **M** | Perf measurement + targeted fixes (entry #5) | MEASUREMENT + FIX | varies | 1–3 | I + J + K + L all landed (visual + token state stable for canonical baseline) |
| **Close** | 13-3 PHASE_LOG entry + DRIFT bookkeeping + README state-line | DOCS | ~80 | 1 | All above |

**Estimated total: 6-8 atomic commits, ~250-450 LOC depending on entry 5 remediation needs.**

Bundling rationale:

- **J combines Entry 4 + Entry 3** (changed from the kickoff hypothesis) because Entry 3 is 1-line and shares the "theme-aware foreground swap" pattern with the hover fixes. Both close 13-1 a11y thread residuals. Single commit if total stays ≤ 30 LOC.
- **K stays solo** because of the diagnostic anomaly. May need a quick measurement re-run before any commit lands. If diagnostic resolves to "axe was wrong, current token already passes", K becomes a closure-only DRIFT bookkeeping line in the close commit.
- **L stays solo** per the M3 commit 11 precedent for cross-cutting refactor work — single commit unless visual judgment per call site bloats past 250 LOC, in which case split by domain (player / admin / super-admin / shared components).
- **M last** so the canonical perf baseline measures the final 13-3 state, not an interim build.

---

## 5. Decisions needed before execution

### 5.1 Entry 2 (`text-ink-muted`) — diagnostic-first

**Specific question:** is the token actually rendering as `#90908f` (axe's claim, fails AA) or `#4a4a4a` (CSS file content, passes AA)?

**Recommendation:** **Spawn a quick Vercel-preview re-run of the axe walker against `44b4a74`** before opening Batch K. If `#90908f` is reproduced, dig into the cascade override (most likely a Tailwind plugin or `@theme` block layering) before any token bump. If `#4a4a4a` renders cleanly, close the entry as audit-resolved-no-code-change in 13-3 close.

If a bump IS needed: subagent A's `#303030` recommendation is the safest one-line target (clears 4.5:1 on bone + surface + surface-muted with margin).

**User must confirm:** OK to defer Batch K until the diagnostic re-run resolves the anomaly?

### 5.2 Entry 5 — measurement vehicle + close-gate threshold

**Specific question:** what's the canonical Lighthouse target + measurement vehicle for 13-3 close?

Plan §16 step 1 says Performance ≥ 90 on top routes. Locked decision (13-1) says real-device or Vercel preview > WSL. Two sub-questions:

1. **Vehicle.** Vercel preview Lighthouse (production build, runs in Lighthouse-CI service or via WebPageTest)? Real-device Android Chrome? Both?
2. **Threshold.** ≥ 90 across all 10 anchor surfaces? ≥ 90 on top 5 player surfaces only (the customer-facing path)? Best-of-N runs to absorb variance?

**Recommendation:**
- **Vehicle:** Vercel preview production-build Lighthouse runs via `npx lighthouse <preview-url>` (already wired in `scripts/baseline-13-1.mjs`'s Lighthouse-CLI integration). Real-device Android Chrome confirmation as a manual operator-side check banked for 13-8 pre-launch QA, NOT 13-3 close. Reason: real-device Lighthouse isn't repeatable in the codebase test suite; Vercel preview is.
- **Threshold:** Stage 2-equivalent close gate of ≥ 90 on the top 5 player surfaces (`/`, `/play`, `/tournaments/[id]`, `/t20`, `/me`) — these are the customer-facing critical path. Admin / super-admin surfaces deferred to ≥ 80 (acceptable for desktop-only admin operator workflows). Document below-threshold surfaces with a remediation entry rather than blocking 13-3 close.

**User must confirm:** vehicle + threshold + which surfaces are MUST-MEET vs NICE-TO-MEET.

### 5.3 Entry 6 — canonical replacement strategy

**Specific question:** for `rounded-xl` callers, what's the replacement decision rule?

Three options:

- **(a) Per-call visual judgment** (subagent C's recommendation) — ~70% to `rounded-[14px]`, ~30% to `rounded-[10px]` based on surface type. Cleanest visually; takes longer.
- **(b) Wholesale `rounded-xl` → `rounded-[14px]`** — single sed pass, all 181 callers in one transform. Loses the chip-tight ~30% but ships faster. Risk: scorecard end buttons + form input wrappers visibly look "bigger / wrong".
- **(c) Wholesale `rounded-xl` → `rounded-lg`** — Tailwind v4's `rounded-lg` resolves to the canonical 10px in this codebase's `@theme inline` block. Bridges naming with mechanical simplicity.

**Recommendation:** **(a) per-call visual judgment** with the heuristic locked at the start of Batch L (cards / containers → `rounded-[14px]`; inputs / buttons / chips → `rounded-[10px]`). Splits naturally by surface type if the commit exceeds 250 LOC. Matches M3 commit 11's approach.

**User must confirm:** OK with per-call judgment + the 70/30 heuristic + split-if-needed?

### 5.4 Entry 1 — mount location

**Specific question:** does `<SerwistProvider>` mount at the root `app/layout.tsx` or at the player layout `app/(player)/(gated)/layout.tsx`?

**Recommendation:** **root layout** — the SW caches everything navigable, including auth + admin + marketing routes. Mounting at the player layout means admin / super-admin / public routes don't get SW caching, which contradicts the Phase 8d offline-first contract. There's no security reason to scope SW to authenticated routes only (the SW only caches static assets + GET responses).

**User must confirm:** mount at root layout, not player layout?

### 5.5 No decision needed

- Entry 3 (t20 eyebrow): replacement form is locked precedent from 12-fixup-2.
- Entry 4 (hover audit): fix template is locked precedent from commit 12.

---

## 6. Out-of-scope surfaces (flagged but deferred)

Per the brief + prior phase closes:

- **Operator-side Supabase auth rate-limit dashboard verification** — banked for 13-7 launch checklist.
- **`admins-without-club-memberships-invisible-to-players`** — Phase 14 RLS hardening (opened at 13-2b close).
- **`partial-profile-vs-anonymised-display-conflation`** — Phase 14 polish.
- **`server-now-pattern-react-compiler`** — Phase 14 codebase guidance.
- **`vercel-cron-secret-pre-deploy-checklist`** — Phase 13 / 13-7 launch infra.
- **shadcn primitives' `rounded-lg` (113 callers)** — out of `rounded-xl-tier-sweep` scope per the entry notes; deferred to post-v1.

---

## 7. Branch tip + readiness

Branch tip: `44b4a74`. No changes from this report — read-only audit only.

Standing by for design-check responses on §§ 5.1 / 5.2 / 5.3 / 5.4, then Batch I (SW registration) opens.
