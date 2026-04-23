# HandiBowls — Drift Log

Single source of truth for every piece of drift between Claude Design output / rebuild-plan intent and shipped code. Everything here is **deliberately deferred** — either to Phase 12.5 (design fidelity polish) or to a named later phase. Nothing here is "maybe one day"; every entry has an owner-phase.

**Rules:**
- Every new drift item gets logged here in the same commit it's discovered in. If it can't be logged, it can't be deferred — fix it inline.
- Append-only during a phase. When a drift item is fixed, change `- [ ]` to `- [x]`, wrap the text in `~~strike-through~~`, and append `Closed: <phase> <SHA>`. Never delete entries.
- Claude Code owns updates. Human reviews at phase-end.
- Open count: `grep -c "^- \[ \]" DRIFT_LOG.md`
- Closed count: `grep -c "^- \[x\]" DRIFT_LOG.md`
- Every stop-and-report includes: `Drift log: N open (M new this phase, K closed this phase).`

---

## Phase 12.5 — Design fidelity polish (primary target)

### Landing surface — `app/page.tsx` + `app/(marketing)/_sections/`

- [ ] **T20 compass card — wedge labels missing.** Design shows `N / NE / E / SE / S / SW / W / NW` + `A / B / C / D` grades inside each wedge. Shipped has blank wedges with only N/E/S/W on the outer ring. Discovered: Phase 4 prep, 2026-04-23.
- [ ] **T20 compass card — grade legend wording drifted.** Design: `A · On the jack / B · In zone / C · Off zone / D · No bowl`. Shipped: `A — dead weight to the jack / B — hugs the zone / C — in the head / D — off the rink`. BSA-aligned wording lost. Discovered: Phase 4 prep, 2026-04-23.
- [ ] **T20 compass card — metadata drifted.** Design: `BSA T20 · DRAW SHOT`, `END 4 OF 20`, `82%` running percentage. Shipped: `STATION 3 · DRAW TO JACK`, `END 4 OF 6`, no percentage. Discovered: Phase 4 prep, 2026-04-23.
- [ ] **Top nav system — pill vs text-links.** Design: pill-style `LANDING / LOGIN / SIGNUP / INVITE`, teal "BOWLS" wordmark. Shipped: text links `Product / Tournaments / T20 / Clubs / About`, all-black wordmark. Discovered: Phase 4 prep, 2026-04-23.
- [ ] **Hero heading wording.** Design: "TAP WHERE IT FINISHED. ZONES, GRADES, PERCENTAGES — HANDLED." Shipped: "EIGHT ZONES. ONE JACK. PROOF YOU'RE IMPROVING." Decide at polish. Discovered: Phase 4 prep, 2026-04-23.

### Auth surfaces — `app/(auth)/`

- [ ] **Checkbox arbitrary variant.** Uses `peer-checked:[&>svg]:opacity-100` — non-standard. Replace with shadcn primitive. File: `app/(auth)/_components/Checkbox.tsx`. Discovered: Phase 3 follow-up.
- [ ] **SpeckleField per-instance seed missing.** `patternId` lacks per-instance seed; two adjacent cards with same preset share a pattern. Not currently triggered. File: `components/brand/SpeckleField.tsx`. Discovered: Phase 3 follow-up.
- [ ] **Hero pocket highlight — ~2% hex drift.** `-skew-x-[8deg]` + rgba approximation vs Design preview. Non-blocking. Discovered: Phase 3 follow-up.

### Admin chrome (Phase 7 output, added when shipped)

*(empty)*

### Player surfaces (Phase 8 output, added when shipped)

*(empty)*

### T20 compass capture (Phase 10 output, added when shipped)

*(empty)*

---

## Other phases (non-design drift)

### Phase 5 — Profile setup

- [ ] **Signup first_name / last_name fields unused.** Rendered + submitted but `signUpAction` only uses email + password. Wire in Phase 5. Files: `app/(auth)/signup/`, `lib/auth/actions.ts signUpAction`. Discovered: Phase 3 follow-up.
- [ ] **Signup "check your inbox" success card unreachable.** Component built but `signUpAction` redirects to `/me/setup`. Decide at Phase 5 whether to wire or delete. Discovered: Phase 3 follow-up.

### Phase 11 — Comms

*(empty)*

### Phase 13 — Technical polish

- [ ] **Vitest Windows worker-pool flake.** `npm test` pinned to `--fileParallelism=false` via Phase 4 prep Commit C. Upstream vitest 4.1.4 + Windows issue. Revisit when vitest ships a fix. File: `package.json`. Discovered: Phase 4 prep, 2026-04-23.
- [ ] **RLS test club teardown.** `tests/rls/helpers.ts` seeds `test-%` clubs without cleanup. Phase 4 prep did a one-time manual wipe. Add `afterAll` teardown. Discovered: Phase 4 prep, 2026-04-23.
- [ ] **Supabase local Storage healthcheck flake.** `npx supabase start` requires `--ignore-health-check` on Windows WSL2 due to slow service boot. Services are actually healthy; CLI window is too short. Revisit when Supabase CLI ships longer healthcheck windows or when the rebuild is cross-platform. Discovered: Phase 4 prep, 2026-04-23.
- [ ] **vitest.rls.config.ts covers non-RLS tests.** Config now runs both tests/rls/andtests/rpc/. File name mildly misleading. Rename to vitest.integration.config.ts at Phase 13 polish (trivial rename + package.json script update). Discovered: Phase 4a, 2026-04-23.
- [ ] **TanStack Table + Virtual + React Compiler lint warnings.** `react-hooks/incompatible-library` warnings on `useReactTable()` and `useVirtualizer()` — libraries return functions the compiler can't memoise. Upstream TanStack issue; warnings are not errors and unsuppressable without disabling the rule. Revisit when TanStack ships a compiler-friendly API or an ESLint-rule escape hatch. Files: `app/(super-admin)/platform/clubs/_components/ClubsTable.tsx`, `app/(super-admin)/platform/clubs/[id]/_components/MembersTab.tsx`. Discovered: Phase 4b, 2026-04-23.
- [ ] **Playwright prod server slow on Windows.** `next start` on Windows cold-serves `/login` POST in 30-40s and RSC prefetches in 10-15s each on first access, which forced 300s test timeout / 60s expect.toBeVisible in `e2e/theme-flip.spec.ts`. Warm requests are <1s. Likely Next 16 + Windows fetch DNS + Supabase auth round-trip layering. Revisit when either Next ships faster cold starts on Windows, or CI moves to Linux. File: `playwright.config.ts`. Discovered: Phase 4b, 2026-04-23.
- [ ] **`"use client"` constant-taint sweep.** Any `"use client"` module exporting a plain const or type consumed by a server component silently resolves to empty/placeholder in prod builds. Two known occurrences found and fixed in 4b: `components/brand/ThemeApplier.tsx` (split `THEME_PRESETS` into `theme-presets.ts`) and `app/(super-admin)/platform/clubs/[id]/_components/ClubTabs.tsx` (split type/guard into `club-tabs-types.ts`). Pattern likely exists elsewhere. Phase 13 task: grep every `"use client"` module for non-component exports, audit consumers, split pure modules where needed. Discovered: Phase 4b, 2026-04-23.
- [ ] **`proxy.ts` `getSession()` deprecated.** Supabase SSR v0.8 prefers `getUser()` (verifies JWT against the auth server). `getSession()` only reads cookies. Non-blocking — still works — but replace at Phase 13 polish. File: `lib/supabase/proxy.ts`. Discovered: Phase 4b, 2026-04-23.

### Cross-cutting

- [ ] **Landing nav anchor hrefs.** `#product`, `#tournaments` etc. anchor to in-page IDs. If later phases promote these to routes, hrefs change. Informational. Discovered: Phase 3 follow-up.

---

## Closed items (audit trail)

- [x] ~~**Q11 impersonation flag removal.**~~ Closed: Phase 4 prep Commit A (`cb77dbb`), 2026-04-23.
- [x] ~~**Invite preset fallback → `core-black`.**~~ Closed: Phase 4 prep Commit B (`03c6fb0`), 2026-04-23.
- [x] ~~**`InviteBackground` decorative splatter themed-by-club.**~~ Closed: Phase 4 prep Commit D (`7f8f975`), 2026-04-23.
- [x] ~~**T20 v2 rubric additions — A+ split, distance buckets, coach-validated grading, positioning copy.**~~ Scope added to Phase 10 via plan amendment. Closed: plan amendment `319e205`, 2026-04-23.
