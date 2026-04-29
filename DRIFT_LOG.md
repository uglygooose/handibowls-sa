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

## Phase 4c.6 — blocking (must close before 4d)

- [x] ~~**`@hookform/resolvers@3.10.0` incompatible with Zod 4.** `zodResolver` checks `Array.isArray(error?.errors)` but Zod 4 renamed `ZodError.errors` → `ZodError.issues`. Every `form.trigger()` call throws and every form submit rejects silently; the bug was masked in 4c by the auth-timing redirect. Fix: bump to `@hookform/resolvers@^5` (or latest Zod 4-compatible major), rerun all form-bearing suites (signup, login, invite accept, all 5 wizard steps), verify E2Es green. Discovered: Phase 4c.5 diagnosis. Owning phase: 4c.6.~~ Closed: 4c.6 (`84ed0d4`), 2026-04-23.
- [x] ~~**createClub RPC statement_timeout + dev-invite-banner gate + draft back-compat shim.** Three layered issues unmasked by fixing each in turn. (1) `create_club_with_dependencies` (migration 014) has no function-level `statement_timeout` and inherits `authenticated`'s 5s role-level default; over PostgREST HTTP the RPC tripped SQLSTATE 57014 ("canceling statement due to statement timeout") on Windows WSL2 cold-invocation, while 40/40 integration tests passed via direct psql (as postgres/supabase_admin, uncapped). Migration 016 hoists a per-function `set statement_timeout to '30s'` on the function definition (PostgREST 12.2+ pattern — scoped per-RPC, doesn't weaken `authenticated`'s global ceiling). (2) Unmasked by (1): the E2E reached the club detail page for the first time and exposed `isDevBannerEnabled()` returning false under Playwright's prod-build server because `next build` inlines `NODE_ENV === "production"` into client bundles. Gate rewritten to be production-opt-out via `NEXT_PUBLIC_APP_ENV` (prod deploys must set `NEXT_PUBLIC_APP_ENV=production`); `.env.test` adds `NEXT_PUBLIC_APP_ENV=test` as an explicit E2E opt-in. (3) Strict-parse cleanup in `_draft.ts`: removed the pre-TTL legacy-payload branch (per CLAUDE.md "don't use backwards-compat shims when you can just change the code"; pre-launch, zero real drafts to preserve). Discovered: Phase 4c.6 E2E unblock, 2026-04-24.~~ Closed: 4c.6 (`15cdf0f`), 2026-04-24.

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

- [ ] **Hydration mismatch on TournamentsList with junk URL params.** Server-rendered HTML vs client first-render diverges when allow-list filter rewrites URL params during initial render. Page works correctly; warning is cosmetic. Likely needs <Suspense> around useSearchParams or stable URL parsing. Owning phase: Phase 13. Discovered: Phase 7 manual QA, 2026-04-29.
- [ ] **`profile_id` vs `auth.users.id` confusion in queries joining auth.users.** Has now bitten twice — Finding 3 (host-club lookup queried wrong table) and Finding 4 diagnosis (cloud SELECT example used `user_id` not `profile_id` in `club_admin_assignments`). Audit every query that joins or filters on `auth.users` to confirm domain FKs are named correctly. Owning phase: Phase 13. Discovered: Phase 7 manual QA, 2026-04-29.
- [ ] **Phase 7 Lighthouse score (`/manage/tournaments/[id]` 86/100/96/91) was measured against a 404 page, not the real detail page.** The `matches:matches(count, status)` embed returned PostgREST 400 from day one (Phase 7c-i landing commit `98d4448`). Re-run Lighthouse against the working detail page after Finding 4 fix lands. Update Phase 7 manual QA notes. Owning phase: Phase 7 retrospective. Discovered: Phase 7 manual QA, 2026-04-29.
- [ ] **PostgREST embed audit across `_data.ts` files.** Phase 7 admin scorecard match-consuming tabs (Draw / Scoring / Rinks) had a broken `rink:rinks(name)` embed introduced at Phase 7c-i (commit `98d4448` adjacent), masked by the Phase 7 Finding 4 retrospective which fixed an adjacent `matches:matches(count, status)` embed but not this one. Latent until Phase 8 manual QA exposed the same bug across three surfaces (Findings 10, 11, and the Phase 7 admin site). Resolved alongside Phase 8d Findings 10 + 11 in a single atomic commit by extracting `formatRinkLabel` to `lib/format/rink.ts`. Owner: **Phase 13 audit** — sweep all PostgREST embeds in every `_data.ts` and verify every column reference matches the actual schema. Two patterns now repeated (multi-projection aggregate; non-existent column reference) — the audit should grep `\.select\(` for nested `(`, list each embed, and cross-check against `types/database.types.ts`. Discovered: Phase 8d manual QA, 2026-04-29.
- [ ] **Tournament detail RPC consolidation.** Multi-embed PostgREST queries (count + status grouping) are fragile and have already broken once. When player scorecard / T20 / other detail pages need similar shapes, batch them into RPCs returning aggregated row + counts in one round-trip (e.g. `tournament_summary(uuid)`). Owning phase: Phase 12. Discovered: Phase 7 manual QA, 2026-04-29.

#### Decisions (documentation only — not open work)

- **AdminSidebar foot card contract: club name (club_admin) / user name (super_admin).** Primary line shows club name when there's a single club to display; user name when there isn't. Bowl-vs-avatar branching tied to this contract. Phase 8 player surfaces will need their own contract decision (players can be at multiple clubs). Owning phase: documentation only — no follow-up work. Recorded: Phase 7 manual QA, 2026-04-29.

### Player surfaces (Phase 8 output, added when shipped)

- [ ] **Mocked-Supabase action tests bypass RLS — class-of-bug.** Action-layer tests under `tests/lib/tournaments/club-admin-actions.test.ts` (and similar) mock the Supabase chain at the `from(...).update(...)` level. The mock accepts the call and returns success regardless of what RLS would actually do in the real DB. This bit Phase 8d Diagnostic 1: `submitMatch` was silently no-opping in production while its action test passed (mocked UPDATE returned ok). Migration 028 fixed the symptom (added participant UPDATE policy), but the diagnostic bug-class remains: any future protected mutation can ship with a passing mocked test and a broken real path. Owner: **Phase 13 audit** — sweep all action-layer tests, ensure each protected mutation has at least one real-RLS integration test (test client signed in as the role under test) covering deny + allow paths. Pattern established by `tests/rls/matches.test.ts` migration-028 cases. Discovered: Phase 8d Diagnostic 1, 2026-04-29.
- [x] ~~**Phase 8c scoring grid drifted from design source.**~~ Phase 8c shipped Win 1/2/3 + Lose 1/2/3 buttons (6 added, not in `handibowls/project/player-pages.jsx:PageScorecard`) and missed Mark peel + Skip (2 design-spec items dropped). Closed: Phase 8d follow-up, 2026-04-29 — Win/Lose removed; Mark peel + Skip added matching the design source's outline-button treatment + eye/X icons. Component contract pinned by `tests/app/player/scorecard-live-controls.test.tsx`. **Precedent for Phase 12.5 audit:** sweep all surfaces against `handibowls/project/*.jsx` design sources, log every delta. This entry is the template.
- [ ] **Mark peel vs Skip differentiation in `match_ends`.** The Phase 8d alignment shipped both buttons writing identical 0/0 rows — peel and skip are functionally indistinguishable in the DB. Domain-correct semantics: peel = drawn end (both teams played, neither closer to jack); skip = end abandoned / not played (rare: weather, rink moved, disputed bowl). The design source's buttons are UI-only stubs without onClick contracts so this isn't strictly drift FROM design, but it is a domain gap. Phase 12 polish: thread a `notes` value (`'peel'` / `'skipped'`) through Dexie outbox + `upsertMatchEnd` action + match_ends column. Owner: Phase 12. Discovered: Phase 8d follow-up, 2026-04-29.
- [ ] **`matches.submitted_by_team_id` column for passive-vs-active captain rendering.** Phase 8d-prep (migration 026) added the `submission_status` enum but not a column tracking which side actually submitted. The scorecard's `<CaptainSubmittedBranch />` currently renders the action card to both captains; the submitter taps Confirm and gets the action's "Match already submitted" precondition error. UX is functional but not optimal — submitting captain should see a passive "Awaiting opponent" banner instead. Phase 12 polish: add `submitted_by_team_id uuid references tournament_teams(id)` to `matches`, populate in submitMatch, branch the scorecard render on it. Owning phase: Phase 12. Discovered: Phase 8d-prep, 2026-04-29.
- [x] ~~**Match-ends Dexie → server sync worker.** Phase 8c lands the
  scorecard against a Dexie outbox (`public.match_ends` server table
  exists from migration 005 but the client doesn't write to it yet).
  Need a service-worker-driven flush that takes queued Dexie rows,
  upserts them to server `match_ends` via PostgREST INSERT ... ON
  CONFLICT (match_id, end_number) DO UPDATE WHERE local_updated_at >
  server_updated_at, and reconciles via the conflict modal when the
  server is newer. Owning phase: Phase 8d. Discovered: Phase 8c
  build, 2026-04-29.~~ Closed: Phase 8d, 2026-04-29. Resolved via
  client-side `useOutboxFlush` hook (lib/scorecard/use-outbox-flush.ts)
  + the `upsertMatchEnd` Server Action (lib/scorecard/actions.ts)
  enabled by migration 027 (match_ends.updated_at + participant
  UPDATE/DELETE policies). Auto-flush on online + visibility events;
  conflicts surface to `<ConflictResolutionSheet />` with three
  resolutions (use mine / use theirs / dispute). Service worker
  (Serwist via `@serwist/turbopack`) handles cache strategies for
  the player surfaces; write-side queueing lives in Dexie + the
  client flush, not in a sw BackgroundSync queue (avoids
  double-flush since both layers would otherwise replay the same
  Server Action calls).
- [x] ~~**Captain-submitted / opponent-confirmed schema gap.** The
  scorecard's state machine has 5 distinct UI states (in_progress,
  captain_submitted, opponent_confirmed, admin_verified, walkover/
  cancelled) but the `match_status` enum only ships scheduled /
  in_progress / completed / walkover / cancelled. Phase 8c renders
  captain_submitted and opponent_confirmed as the same UI ("Awaiting
  verification") gated on `status='completed' AND
  finalized_by_admin=false` — the player whose POV is the captain
  side and the opposing side both see the OpponentConfirmationCard.
  Need a migration adding two enum values + an action that
  transitions captain_submitted → opponent_confirmed → completed
  rather than the current submitMatch (sets in_progress) →
  confirmMatch (sets completed) collapse. Owning phase: Phase 8d.
  Discovered: Phase 8c build, 2026-04-29.~~ Closed: Phase 8d-prep
  migration 026, 2026-04-29. Resolved via Option (b) — separate
  `submission_status` enum (`pending` / `captain_submitted` /
  `opponent_confirmed`) + `captain_submitted_at` +
  `opponent_confirmed_at` audit timestamps + CHECK constraint pinning
  consistency. Actions updated: submitMatch sets captain_submitted +
  audit timestamp; confirmMatch transitions to opponent_confirmed
  (no longer collapses to status=completed); verifyMatch requires
  opponent_confirmed by default with override-score escape hatch for
  dispute resolution. Open follow-up captured in this same section:
  the "submitted_by_team_id" column for proper passive-vs-active card
  branching is a Phase-12 polish item (currently both captains see
  the action card; the action precondition rejects no-op confirms).

### T20 compass capture (Phase 10 output, added when shipped)

*(empty)*

---

## Other phases (non-design drift)

### Phase 5 — Profile setup

- [x] ~~**Signup first_name / last_name fields unused.** Rendered + submitted but `signUpAction` only uses email + password. Wire in Phase 5. Files: `app/(auth)/signup/`, `lib/auth/actions.ts signUpAction`. Discovered: Phase 3 follow-up.~~ Closed: 5b, 2026-04-28. Wired through both signUpAction (form → service-client profile update) and acceptInviteAction (invite row → service-client profile update). lookupInvite returns first/last for /me/setup prefill.
- [x] ~~**Signup "check your inbox" success card unreachable.** Component built but `signUpAction` redirects to `/me/setup`. Decide at Phase 5 whether to wire or delete. Discovered: Phase 3 follow-up.~~ Closed: 5b, 2026-04-28. Resolved by deletion. Audit found no separate component file — the "dead success card" was a comment block in signup-form.tsx describing the unreachable state. Block removed; no email-confirmation flow planned.
- [x] ~~**Invite page copy says "seven days", schema is 14.** `app/(auth)/invite/[token]/page.tsx:70` hardcodes "Invites last seven days" but `invites.expires_at` defaults to `now() + 14 days` (migration 011). Fix to "14 days" or read from the invite row. Owning phase: 5b. Discovered: Phase 5a, 2026-04-28.~~ Closed: 5b, 2026-04-28.

### Phase 6 — Tournament engine

- [x] ~~**lib/tournaments primitives use uppercase enum vocab.** `labels.ts` and `handicap.ts` reference `SINGLES`/`SCRATCH`/`HANDICAP_START` but Phase 2 schema enums are lowercase (`singles`/`scratch`/`handicap_start`). Tests pass in isolation; modules can't be wired to current DB rows without case-mapping. 6b adapters must address — either case-map at adapter boundary or normalise primitives to lowercase. Recommend case-map at adapter (contained, doesn't rewrite tested logic). Owning phase: 6b. Discovered: Phase 6a, 2026-04-29.~~ Closed: 6b (`7caa5c4`), 2026-04-29. `lib/tournaments/adapters.ts` ships `dbStatusToPrimitive` / `dbFormatToPrimitive` / `dbHandicapRuleToPrimitive` (lowercase → uppercase) plus the reverse `primitiveStatusToDb` for inserts. Both directions covered by tests with explicit round-trip assertions. Primitives stay uppercase as recommended.

### Phase 7 — Admin tournament UI

- [ ] **closeEntries gate semantics — Phase 7 must mirror.** `closeEntries` sets `tournaments.entries_close_at = now()` rather than flipping a status field, because the schema has no "entries-closed-but-not-started" state. Phase 7 admin UI must gate "accepting entries" on `(status='open' AND (entries_close_at IS NULL OR entries_close_at > now()))`. Status only moves to `'in_progress'` when `generateBracket` creates round 1. Document in Phase 7 prompt to prevent UI from re-deriving this gate slightly differently. Owning phase: Phase 7. Discovered: Phase 6d, 2026-04-29.
- [ ] **Tournament batch RPCs missing from rebuild migrations.** Pre-rebuild had `admin_finalize_matches_batch`, `bulk_save_match_scores_batch`, `save_round_fixtures_batch` (308 lines, three PL/pgSQL functions in deleted `supabase/migrations/20260422_tournament_batch_rpcs.sql`). Needed by Phase 7 admin UI for atomic batch fixture editing and bulk scoring; the singular routes also relied on them for winner-propagation + OPEN→SCHEDULED transitions. Restore or rebuild in Phase 7. Owning phase: Phase 7. Discovered: Phase 6a, 2026-04-29.

### Phase 11 — Comms

- [ ] **Dev-only invite banner on new-club detail page.** Phase 4c surfaces the generated admin-invite URL via a sessionStorage-backed banner on `/platform/clubs/[id]` when `NODE_ENV !== 'production' && NEXT_PUBLIC_APP_ENV !== 'production'`. Dismissible, 60-min TTL. Replace with a proper Resend email flow (invite email with branded template + click-through) in Phase 11. Delete the banner component + sessionStorage key once Resend is wired. Discovered: Phase 4c, 2026-04-23.
- [ ] **`v1 blocker — Phase 11 must close.` acceptInviteAction can't handle returning users.** `lib/auth/actions.ts acceptInviteAction` calls `auth.admin.createUser` unconditionally; a second invite for an email that already has an auth.users row returns "user already registered" and the player is stuck. Surfaced by the Phase-5e dual-club E2E, which works around it via service-role membership insert + sign-out/sign-in. **Pairs with the JWT-claim entry below: until both close, the dual-club switcher works visually but the only UI path to acquire a second membership (invite acceptance) is broken.** Fix when invite emails are wired (Phase 11): detect the existing user, skip createUser, just add the membership and prompt re-sign-in. Discovered: Phase 5e, 2026-04-28.
- [ ] **`v1 blocker — Phase 11 must close.` JWT club_ids claim is stale until next sign-in.** `custom_access_token_hook` (migration 009) bakes club_ids into the JWT at issuance. Adding a player to a new club via any path that doesn't trigger sign-in (admin direct insert, future "claim invite for existing user" flow) leaves the existing JWT's claim outdated, which RLS policy `player_read_own_clubs` then uses to block reads of the new club's row in the layout's `clubs!inner` join. The membership exists but the second club name doesn't render until re-auth. **Pairs with the acceptInviteAction entry above; both must close together for v1 dual-club to actually function in production.** Fix when same-user invite acceptance lands (Phase 11): force `auth.refreshSession()` on the client after a successful membership add, OR have the server-side flow emit a sign-in redirect. Discovered: Phase 5e, 2026-04-28.

### Phase 12 — Stakeholder polish

- [ ] **Feeder match_no display via hash fallback in DrawTab.** `components/tournament/MatchCard.tsx` and the bracket rendering display "Winner of M##" using a hash of `slot_*_source_match_id`'s last 3 hex chars (1–99 pseudo-number) because the joined feeder match's `match_no` isn't on the row. When match-modal-from-feeder navigation lands (Phase 7d or later), replace with real `match_no` via a join on `matches`. Owning phase: Phase 7d if navigation ships there; else Phase 12. Discovered: Phase 7c-ii, 2026-04-29.
- [ ] **Tournament ↔ greens link missing.** No join table or array column on `tournaments` connects a tournament to the greens it uses. Phase 7b's "Greens to use" picker on `/manage/tournaments/new` is currently UI-state-only — selection isn't persisted because there's nowhere to write it. Rink assignment happens at match-scheduling time today (matches.rink_id), but admins want to scope greens at create time so the rink fairness algorithm only ever picks from the chosen surfaces. Add `tournament_greens` join table (tournament_id + green_id, composite PK) in a Phase-12 cross-cutting migration, then wire the picker. Owning phase: Phase 12. Discovered: Phase 7b, 2026-04-29.
- [ ] **`tournaments.fair_rink` column missing.** No column for the Fair Rink toggle exposed by the Phase 7b creation form. UI state-only. Toggle defaults to true and helper text explains the recommendation, but the value is dropped on submit. Add `fair_rink boolean not null default true` in a Phase-12 cross-cutting migration alongside the rink-fairness algorithm work. Owning phase: Phase 12. Discovered: Phase 7b, 2026-04-29.
- [ ] **Tournament drafts not implemented.** Phase 7b's "Save as draft" button is rendered disabled with a tooltip pointing here. The `tournament_status` enum already has `'draft'` so the column exists — what's missing is the action wiring (a `saveTournamentDraft` action that inserts with status='draft' + skips required-field validation) and a list-page draft surface. Drafts also need to integrate with the audit-log empty-state copy ("Audit log activates when actions begin generating events"). Owning phase: Phase 12. Discovered: Phase 7b, 2026-04-29.
- [ ] **BSA seeding algorithm details unverified.** Three-method framing (random / seeded / sectional, encoded in `tournaments.seeding_method` enum + `lib/tournaments/seeding.ts`) is confirmed at the structural level against BSA Domestic Regulations + Standard Procedures + Port Natal Conditions of Play + World Bowls Laws Decisions. Algorithm-specific details — whether handicap balancing is canonical, whether districts have local variations, whether sectional advancement counts (top M) are nationally fixed — were not surfaced in public-source research and should be verified with a BSA-accredited coach before being treated as canonical. Owning phase: Phase 12 (stakeholder-input polish). Discovered: Phase 6a, 2026-04-29.

### Phase 13 — Technical polish

- [ ] **tz-naive date formatters across pre-Phase-7 surfaces.** Five sites use `new Date(s).toLocaleDateString(...)` without an explicit `timeZone` — that's the browser's local zone, not Africa/Johannesburg per project standards. Phase 7b extracted `lib/format/dates.ts` with `formatDateZA` etc. backed by `Intl.DateTimeFormat({ timeZone: 'Africa/Johannesburg' })`; Phase 7's surfaces (TournamentCard, TournamentsList, and from 7c-i onward) already go through the helper. Pre-Phase-7 sites carry the bug: `app/(player)/(gated)/me/_components/ClubMembershipList.tsx:72`, `app/(super-admin)/platform/clubs/[id]/_components/MembersTab.tsx:101`, `app/(super-admin)/platform/clubs/[id]/_components/TournamentsTab.tsx:45`, `app/(super-admin)/platform/clubs/[id]/_components/AdminsTab.tsx:41`, `app/(club-admin)/manage/members/_components/MembersTable.tsx:50`. Replace with helpers from `lib/format/dates.ts` at Phase 13. Owning phase: Phase 13. Discovered: Phase 7b, 2026-04-29.
- [ ] **AdminSidebar duplication across branches.** Phase 7's version is canonical at Phase 13 reconcile. Phase 7 preserved the splatter accent from Phase 4 design integration's version with theme-token-driven colour (Phase 4 hardcoded `preset="atomic-red"`; Phase 7 wires `identity.decorPreset` so the splatter tracks the active club preset for club_admin variant and falls back to `"atomic-red"` for super_admin). No reconcile work expected — Phase 4's branch is parked at `df7a384` and its sidebar is logically a subset of Phase 7's. Owning phase: Phase 13. Discovered: Phase 7-prep, 2026-04-29.
- [ ] **§18 documentation drift — `bracket.ts` content vs §18 mapping.** HANDIBOWLS_REBUILD_PLAN.md §18 line 1026 maps `lib/tournaments/bracket.ts` → `lib/tournaments/brackets/knockout.ts` ("Moved; same exports re-exported"). On disk `bracket.ts` is label helpers (`largestPowerOfTwoLE`, `roundLabel`, `finishPlacementLabel`), not knockout pairing. Phase 6a kept `bracket.ts` in place (renaming would mislabel content) and wrote a fresh `lib/tournaments/brackets/knockout.ts` for the round-1 pairing primitive — preserving §18's INTENT (knockout primitive exists) while diverging from §18's letter (bracket.ts source). Update §18 line 1026 + §9 step 1/2 to reflect on-disk reality at the Phase-13 plan reconciliation. Discovered: Phase 6a, 2026-04-29.
- [ ] **Vitest Windows worker-pool flake.** `npm test` pinned to `--fileParallelism=false` via Phase 4 prep Commit C. Upstream vitest 4.1.4 + Windows issue. Revisit when vitest ships a fix. File: `package.json`. Discovered: Phase 4 prep, 2026-04-23.
- [ ] **RLS test club teardown.** `tests/rls/helpers.ts` seeds `test-%` clubs without cleanup. Phase 4 prep did a one-time manual wipe. Add `afterAll` teardown. Discovered: Phase 4 prep, 2026-04-23.
- [ ] **Supabase local Storage healthcheck flake.** `npx supabase start` requires `--ignore-health-check` on Windows WSL2 due to slow service boot. Services are actually healthy; CLI window is too short. Revisit when Supabase CLI ships longer healthcheck windows or when the rebuild is cross-platform. Discovered: Phase 4 prep, 2026-04-23.
- [ ] **vitest.rls.config.ts covers non-RLS tests.** Config now runs both tests/rls/andtests/rpc/. File name mildly misleading. Rename to vitest.integration.config.ts at Phase 13 polish (trivial rename + package.json script update). Discovered: Phase 4a, 2026-04-23.
- [ ] **TanStack Table + Virtual + React Compiler lint warnings.** `react-hooks/incompatible-library` warnings on `useReactTable()` and `useVirtualizer()` — libraries return functions the compiler can't memoise. Upstream TanStack issue; warnings are not errors and unsuppressable without disabling the rule. Revisit when TanStack ships a compiler-friendly API or an ESLint-rule escape hatch. Files: `app/(super-admin)/platform/clubs/_components/ClubsTable.tsx`, `app/(super-admin)/platform/clubs/[id]/_components/MembersTab.tsx`, `app/(super-admin)/platform/districts/_components/DistrictsTable.tsx`, `app/(club-admin)/manage/members/_components/MembersTable.tsx`. Discovered: Phase 4b, 2026-04-23. Extended: Phase 4d, 2026-04-25; Phase 5b, 2026-04-28.
- [ ] **Playwright prod server slow on Windows.** `next start` on Windows cold-serves `/login` POST in 30-40s and RSC prefetches in 10-15s each on first access, which forced 300s test timeout / 60s expect.toBeVisible in `e2e/theme-flip.spec.ts`. Warm requests are <1s. Likely Next 16 + Windows fetch DNS + Supabase auth round-trip layering. Revisit when either Next ships faster cold starts on Windows, or CI moves to Linux. File: `playwright.config.ts`. Discovered: Phase 4b, 2026-04-23. Phase 4d follow-up: theme-flip cold-streamed `/platform/clubs/[id]` and never hydrated `tab-theme` within 60s on ~50% of fresh-build runs; absorbed via `retries: 1` (was `0` locally, `1` on CI). Drop the local retry once cold-serve is stable. Extended: Phase 4d, 2026-04-25.
- [ ] **`"use client"` constant-taint sweep.** Any `"use client"` module exporting a plain const or type consumed by a server component silently resolves to empty/placeholder in prod builds. Two known occurrences found and fixed in 4b: `components/brand/ThemeApplier.tsx` (split `THEME_PRESETS` into `theme-presets.ts`) and `app/(super-admin)/platform/clubs/[id]/_components/ClubTabs.tsx` (split type/guard into `club-tabs-types.ts`). Pattern likely exists elsewhere. Phase 13 task: grep every `"use client"` module for non-component exports, audit consumers, split pure modules where needed. Discovered: Phase 4b, 2026-04-23.
- [x] ~~**`proxy.ts` `getSession()` deprecated.** Supabase SSR v0.8 prefers `getUser()` (verifies JWT against the auth server). `getSession()` only reads cookies. Non-blocking — still works — but replace at Phase 13 polish. File: `lib/supabase/proxy.ts`. Discovered: Phase 4b, 2026-04-23.~~ **Superseded by Phase 4c.5** — `proxy.ts` intentionally uses `getSession()` + local JWT decode for routing decisions to avoid a concurrent-`getUser()` race under Next.js RSC prefetch. Authoritative auth checks (`requireRole`, RLS, server actions) continue to call `getUser()`. Superseded: 4c.5 (`d19c09d`), 2026-04-23.

### Cross-cutting

- [ ] **Landing nav anchor hrefs.** `#product`, `#tournaments` etc. anchor to in-page IDs. If later phases promote these to routes, hrefs change. Informational. Discovered: Phase 3 follow-up.

---

## Closed items (audit trail)

- [x] ~~**Q11 impersonation flag removal.**~~ Closed: Phase 4 prep Commit A (`cb77dbb`), 2026-04-23.
- [x] ~~**Invite preset fallback → `core-black`.**~~ Closed: Phase 4 prep Commit B (`03c6fb0`), 2026-04-23.
- [x] ~~**`InviteBackground` decorative splatter themed-by-club.**~~ Closed: Phase 4 prep Commit D (`7f8f975`), 2026-04-23.
- [x] ~~**T20 v2 rubric additions — A+ split, distance buckets, coach-validated grading, positioning copy.**~~ Scope added to Phase 10 via plan amendment. Closed: plan amendment `319e205`, 2026-04-23.
