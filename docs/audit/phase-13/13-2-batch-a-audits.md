# Phase 13 / 13-2 / Batch A — Read-Only Security Audits

Captured: 2026-05-02
Branch tip at audit: `c84becd`
Methodology: 6 parallel `Explore` subagent runs (A1–A6) + 1 main-thread audit (A7).

This report consolidates 7 read-only audits scoping the security half of
Phase 13 / 13-2. No code changes were made. No DRIFT_LOG entries were
opened or closed. Findings are classified for batched follow-up
(Batch B / C / D bookkeeping).

---

## A1 — DRIFT-L45 — `profile_id` vs `auth.users.id` confusion

**Background.** Two production bugs (Phase 7 Findings 3 + 4) shipped from
queries joining the wrong column when both `auth.users.id` and
`profile_id` were available. `profiles.id = auth.users.id` (1:1); domain
FKs reference `profiles.id`.

**Method.** Grep all `_data.ts` + `_actions.ts` + `actions.ts` files
under `app/` for queries joining or filtering on `auth.users`,
`user_id`, `profile_id`, `created_by`, `updated_by`, `submitted_by`,
`verified_by`, plus `supabase.auth.getUser()` chains using `.id`.
Cross-checked against `types/database.types.ts`.

**Files audited.** 33 files (21 `_data.ts` + 12 `_actions.ts`).

**Findings.** Every query uses the correct FK column for its table's
convention:
- `profile_id` direct FKs (e.g. `tournament_team_members.profile_id`,
  `notifications.profile_id`, `t20_assessments.profile_id`,
  `club_memberships.profile_id`): 14 occurrences, all
  `.eq("profile_id", ctx.userId)`.
- Semantic FKs (`booked_by`, `for_profile_id`, `created_by`,
  `assessor_id`, `sender_id`, `performed_by`, `assigned_by`,
  `invited_by`): 12+ embed patterns + 5 insert patterns, all
  reference `profiles` correctly.
- Zero direct `auth.users` table queries from app code (the only
  `auth.users` reference is documented at `manage/members/_data.ts:97`
  with the explicit comment "safe proxy for 'last active' without
  exposing auth.users to PostgREST").
- Zero `user_id` ↔ `profile_id` mismatches.

**Verdict.** **CLEAN** — entry can be closed in Batch B bookkeeping.

---

## A2 — DRIFT-L47 — PostgREST embed audit across `_data.ts`

**Background.** Two production bugs from broken embeds:
`matches:matches(count, status)` aggregate (Phase 7 Finding 4
retrospective) and `rink:rinks(name)` non-existent column (Phase 8d
Findings 10/11).

**Method.** Grep `.select(...)` calls across all `_data.ts`. For each
embed: verify (a) FK relationship exists in
`types/database.types.ts`; (b) all columns referenced exist on the
related table; (c) multi-FK disambiguation is explicit; (d) no
unbounded sub-embeds; (e) RLS reach noted.

**Files audited.** 21 `_data.ts` files. All embeds enumerated — see
appended subagent report for full table.

**Findings.** Subagent flagged 4 cases as `VIOLATION-FK` —
`me/inbox/_data.ts:69` (`club:clubs!club_id`),
`manage/messages/_data.ts:85+161` (`sender:profiles!sender_id` +
`tournament:tournaments!audience_tournament_id`),
`manage/overview/_data.ts:70` (`booker:profiles!booked_by`),
`manage/overview/_data.ts:206` (`performer:profiles!performed_by`).

Subagent's claim: "PostgREST expects `!fkey_name` (e.g.
`audit_log_performed_by_fkey`), not `!column_name`."

**Re-classification (main-thread verification via Supabase docs).**
The subagent is wrong. Supabase's official documentation
(`/supabase/supabase` → `joins-and-nesting.mdx`) shows the canonical
multi-FK disambiguator is `!column_name`, e.g.
`start_scan:scans!scan_id_start (...)` and
`end_scan:scans!scan_id_end (...)`. Both column-name AND
constraint-name forms work; the column-name form is more readable
and is the form Supabase teaches in their own docs. The 4 cases
flagged ship in working production code (verified at the M2 close
baseline running `/manage/messages` and `/manage/overview` against
the dev preview without error).

All 4 reclassified as **VERIFIED-CORRECT**.

**Other findings.**
- Zero `VIOLATION-COLUMN` (no embed references a non-existent
  column on the related table).
- Zero `VIOLATION-CAP` (sub-embeds are bounded — aggregate `count`
  embeds OR explicit `.limit()` on the parent query covers every
  case).
- All multi-FK relationships use explicit `!column_name`
  disambiguation per the canonical pattern.

**Verdict.** **CLEAN** — entry can be closed in Batch B bookkeeping.

---

## A3 — DRIFT-L57 — State-machine-vs-surface matrix

**Background.** Phase 8 burned 5 fix rounds because state-machine
columns were added without auditing every consumer surface.
DRIFT-L57 asks for a state×surface matrix to surface dead enum
values (defined in schema, never produced by any transition) and
orphan states (displayed somewhere but no transition produces them).

**Method.** Enumerate state columns across migrations + cross-check
against `types/database.types.ts`. For each column value, find
producers (transitions writing the value) + consumers (surfaces
filtering or displaying it).

**Findings.** 9 state columns audited. Matrix:

| Column | Total values | Dead | Orphan | OK | Status |
|---|---:|---:|---:|---:|---|
| `tournaments.status` | 5 | 1 (`draft`) | 0 | 4 | VIOLATION |
| `matches.status` | 5 | 0 | 2 (`walkover`, `cancelled`) | 3 | VIOLATION |
| `matches.submission_status` | 3 | 0 | 0 | 3 | CLEAN |
| `bookings.status` | 2 | 0 | 0 | 2 | CLEAN |
| `invites.status` | 4 | 1 (`revoked`) | 1 (`expired`) | 2 | VIOLATION |
| `club_memberships.status` | 3 | 1 (`pending`) | 1 (`inactive`) | 1 | VIOLATION |
| `t20_assessments.status` | 3 | 0 | 1 (`archived`) | 2 | VIOLATION |
| `messages.status` | 4 | 0 | 0 | 4 | CLEAN |
| `message_recipients.in_app_status` | 3 | 0 | 0 | 3 | CLEAN |

**Spot-checked verifications (main-thread):**
- `tournaments.status='draft'` — DB default is `'draft'` (migration
  005 line 18) but `createTournament` action explicitly inserts
  `status: "open"` at `_actions.ts:165`. So tournaments are NEVER
  drafted in v1; the value is dead. Confirmed.
- `matches.status='walkover'` — displayed at
  `Scorecard.tsx:192,403` but no action sets it. Orphan.
  Confirmed.
- `matches.status='cancelled'` — displayed at
  `Scorecard.tsx:193,404`. The only `'cancelled'` write
  (`_actions.ts:1037`) is on `tournaments.status`, NOT
  `matches.status`. Orphan. Confirmed.
- `invites.status='revoked'` — defined in enum (migration 001 line
  94) but no action produces it. Confirmed dead.
- `invites.status='expired'` — computed at read-time
  (`expires_at < now()`); never persisted. Display-only orphan.
- `club_memberships.status='pending'` — invite-pending state lives
  in `invites.status`, not in `club_memberships.status`. Membership
  rows are only inserted on invite redemption (status='active'). Dead.
- `club_memberships.status='inactive'` — schema-allowed but no
  admin deactivation action exists. Orphan.
- `t20_assessments.status='archived'` — schema-allowed but no
  archive action. Orphan.

**Recommended follow-up scope.** Each finding is a small, isolated
hygiene fix:

| Value | Recommendation | Scope |
|---|---|---|
| `tournaments.status='draft'` | EITHER wire a "Save as draft" UI affordance (admin can edit pre-publish) OR remove from enum | M (UI) or S (enum trim) |
| `matches.status='walkover'` | Wire `recordWalkover` admin action (gives admin the path Scorecard already displays) OR remove from enum + Scorecard branch | M (action) or S (trim) |
| `matches.status='cancelled'` | Wire `cancelMatch` admin action OR remove from enum + Scorecard branch | M (action) or S (trim) |
| `invites.status='revoked'` | Wire `revokeInvite` admin action OR remove from enum (current `delete invite` covers the "remove unsent" case) | S |
| `invites.status='expired'` | Materialize via scheduled job (`update invites set status='expired' where ... and expires_at < now()`) OR document as compute-only and accept | S |
| `club_memberships.status='pending'` | Document why the value exists OR remove | S |
| `club_memberships.status='inactive'` | Wire `deactivateMembership` admin action OR remove + cascade member-list filtering | M or S |
| `t20_assessments.status='archived'` | Wire archive action OR remove | S |

**Verdict.** **VIOLATIONS** — 7 dead/orphan values across 5 columns.
None are security-critical (no privilege-escalation, no data
exposure); they are schema-hygiene findings. Recommend Batch B / C
opens 1–2 DRIFT entries grouping the trim-vs-wire decision per
column, or a single consolidated entry.

---

## A4 — DRIFT-L65 — Server-only module poisoning audit

**Background.** `_data.ts` files marked `import "server-only"`
cannot export RUNTIME values consumed by Client Components without
breaking the build. Type-only imports are safe (TypeScript erases).
Risk is silent — fails at build time only.

**Method.** Grep all `_data.ts` files for `import "server-only"`,
list each file's runtime exports, find import sites, classify
SAFE / VIOLATION / AMBIGUOUS.

**Files audited.** 21 `_data.ts` files (all carry the `server-only`
directive).

**Findings.** Every runtime export from a `server-only` `_data.ts`
file is either:
- An async data fetcher (`listUsers`, `getUserDetail`,
  `listTournaments`, etc.) imported only by Server Components and
  Server Actions.
- A type-only export (`export type`, `export interface`) — TypeScript
  erases at compile time, safe across boundaries.

Zero non-component-runtime constants/maps live in `_data.ts` files.
The Phase-12-7 split pattern (`book/_data.ts` + `book/slots.ts`) is
in place: pure helpers + types live in sibling modules WITHOUT the
`server-only` directive. Client Components import only `import type`
from `_data.ts` paths.

**Verdict.** **CLEAN** — entry can be closed in Batch B bookkeeping.
ESLint custom rule out of scope per locked decision (audit-only).

---

## A5 — DRIFT-L279 — `'use client'` constant-taint sweep

**Background.** Any `'use client'` module exporting a non-component
value consumed as a runtime value by a Server Component silently
resolves to undefined in prod builds. Two known fixes shipped at
Phase 4b: `ThemeApplier.tsx` → split `THEME_PRESETS` into
`theme-presets.ts`; `ClubTabs.tsx` → split into `club-tabs-types.ts`.

**Method.** Grep `'use client'` modules across `app/` + `components/`
(excluding shadcn `components/ui/`). For each non-component export,
find import sites, classify SAFE / VIOLATION / AMBIGUOUS.

**Files audited.** 117 `'use client'` modules.

**Findings.**
- Phase 4b fixes verified in place: `ThemeApplier.tsx` re-exports
  from `theme-presets.ts` (universal module); `ClubTabs.tsx`
  imports from `club-tabs-types.ts` (universal module). Both
  patterns SAFE.
- `tabs.ts` (universal module) at
  `manage/tournaments/[id]/_components/tabs.ts` exports
  `ALL_TAB_IDS` + `parseTabFromUrl()` + `TabId` type. Both Server
  Component (page.tsx) and Client Component (TournamentTabs.tsx)
  import correctly. SAFE.
- Two unused exports flagged:
  - `manage/tournaments/_components/form-shell.tsx` exports
    `inputClass` (CSS class string) — never imported.
  - `manage/tournaments/[id]/_components/TournamentTabs.tsx`
    exports `useTabIds` hook factory — never imported.
  Neither is a violation; both are dead code. Drift-candidate
  cleanup, not a security finding.
- Zero VIOLATION findings: no Server Component imports a
  non-component runtime value from a `'use client'` module.

**Verdict.** **CLEAN** — entry can be closed in Batch B bookkeeping.
The two unused exports are dead-code drift, NOT taint violations;
out of scope for Batch A but worth noting for any future cleanup.

---

## A6 — NEW-SERVICE-ROLE-GREP — Service-role key client-bundle audit

**Background.** Rebuild plan §16 step 3 line 1028: "Service-role key
never in client bundle (grep)." `SUPABASE_SERVICE_ROLE_KEY` bypasses
RLS — leaking it into a client bundle is a critical security failure.

**Method.** Grep `app/`, `components/`, `lib/`, `scripts/` +
`middleware.ts` for `SUPABASE_SERVICE_ROLE_KEY`,
`SERVICE_ROLE_KEY`, `service_role_key`, `service_role`,
`serviceRoleKey`, `createServiceClient`, `createServiceRoleClient`,
plus the Next-leak pattern `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.

**Findings.** All references isolated to server-only paths:

| File | Path role | Verdict |
|---|---|---|
| `lib/supabase/service.ts:11,15` | `import "server-only"` guard | SERVER-ONLY-OK |
| `app/(public)/email/unsubscribe/page.tsx:4,60` | Server Component (no `'use client'`) | SERVER-ONLY-OK |
| `app/(super-admin)/platform/clubs/_actions.ts:7,82` | `'use server'` action | SERVER-ONLY-OK |
| `lib/invites/email.ts:10` | `import "server-only"` guard | SERVER-ONLY-OK |
| `lib/invites/actions.ts:8` | `'use server'` action | SERVER-ONLY-OK |
| `lib/email/actions.ts:5` | `'use server'` + `import "server-only"` | SERVER-ONLY-OK |
| `scripts/seed-dev-*.ts` (3 files) + `scripts/diag-offline-scoring.mjs` | Build-time scripts; never reach client | SERVER-ONLY-OK |

**`.env.example` audit.** Includes `SUPABASE_SERVICE_ROLE_KEY=`
placeholder (no value). Correct pattern.

**`.gitignore` audit.** `.env*` ignored with `!.env.example` exception.
`.env.local` is implicitly ignored. No secret-file leak.

**`NEXT_PUBLIC_` exposure check.** Zero references to
`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` anywhere. The `server-only`
package provides hard compile-time enforcement: any attempt to
import `lib/supabase/service` from a Client Component would fail the
build.

**Verdict.** **CLEAN** — closure note for Batch B bookkeeping (this
audit is net-new work, not a tracked DRIFT entry; closure is just
"audit ran, zero violations").

---

## A7 — NEW-RATE-LIMIT — Auth rate-limit audit

**Background.** Rebuild plan §16 step 3 line 1029: "Rate-limit auth
(Supabase built-in)." Per locked decision, audit-only — Supabase
built-in defaults + Phase 12-3 daily cap are deemed sufficient for
v1; custom rate-limiting deferred to post-launch revisit if
observed abuse surfaces.

**Method.**
1. `app/(auth)/*` grep for custom rate-limiting wrappers.
2. Server-action grep across `app/` + `lib/` for `rateLimit`,
   `throttle`, `429`, `Too Many Requests`.
3. Cross-check Phase 12-3 `clubs.daily_broadcast_cap` enforcement.
4. Supabase docs query for default auth rate-limit table.

**Findings.**

**Code-side (project repo).**
- `app/(auth)/*` — auth UI files only (login, signup, invite-accept
  pages + components). Zero custom rate-limiting code. As expected:
  Supabase Auth handles rate-limiting at the platform level.
- The only `throttle` references in app code are for the T20
  assessment-request feature (`t20/_actions.ts:25,77,79` — clubs can
  rate-limit player requests for new assessments). Product-level
  cooldown, not auth/security rate limit.
- The only `rate_limit` reference in `lib/` is at
  `lib/email/client.ts:60,126` — handles Resend's 429 response on
  outbound InviteEmail (consumes an external rate limit, doesn't
  enforce one).

**Phase 12-3 daily broadcast cap (correction).** Per migration 034
(`clubs.daily_broadcast_cap` doc-comment): the column is **reserved
but UNUSED in v1**. Phase 11 ships in-app-only admin messaging
(`messages.send_email` forced false at the compose-action layer);
the only outbound email is system-triggered InviteEmail, which is
exempt from the broadcast cap. The cap will be enforced by a future
SECURITY DEFINER `send_message` RPC when the email channel is
re-introduced.

This contradicts the locked-decision premise that "Phase 12-3 daily
cap covers send_message." In v1, send_message has NO enforced
rate-limit at any layer. The threat model doesn't require one
because:
- Only `club_admin` role can send (RLS enforced).
- Each message creates one row per recipient in
  `message_recipients` (no fan-out blast).
- Recipients can mute / unsubscribe.
- No outbound email path in v1.

So the absence is policy-correct for v1, just not for the reason
the locked decision stated. Documented for the post-launch revisit
DRIFT entry (Batch D bookkeeping).

**Supabase-side (platform defaults).** Per Supabase official docs
(`/supabase/supabase` → `auth/rate-limits.mdx`), Supabase Auth
ships rate-limit defaults on every endpoint:
- `/auth/v1/otp` — OTP/magic-link (default + customizable)
- `/auth/v1/signup` — signup confirmation
- `/auth/v1/recover` — password reset
- `/auth/v1/verify` — verification (IP-address-limited)
- `/auth/v1/token` — token refresh (IP-limited)
- `/auth/v1/factors/:id/...` — MFA
- `/auth/v1/signup` (anonymous) — anon sign-ins (IP-limited)

These apply to the project automatically. Operator-side verification
(user logs into Supabase dashboard at
`/dashboard/project/_/auth/rate-limits`) is required to confirm
defaults haven't been disabled on the dev project. **This audit
cannot read project settings via MCP — operator verification is
deferred to the user.**

**Verdict.** **CLEAN with one operator-side verification needed** —
- Code-side: zero custom rate-limiting (correct per locked decision).
- Supabase-side: defaults documented as enforced; operator must
  confirm via dashboard (out of band).
- Phase 12-3 cap: reserved-but-unused; v1 threat model doesn't
  require enforcement.

Recommend Batch D opens a single DRIFT entry: "Auth rate-limit
revisit post-launch — confirm Supabase defaults active in production
project; consider server-action-level limits on `recordDelivery` /
`send_message` if abuse surfaces; revisit Phase 12-3 daily cap when
admin email channel is re-introduced."

---

## Summary table

| Entry | Verdict | Violations | Followup commits needed |
|---|---|---|---|
| **A1** — DRIFT-L45 (`profile_id` confusion) | **CLEAN** | 0 | Close in Batch B bookkeeping |
| **A2** — DRIFT-L47 (PostgREST embeds) | **CLEAN** | 0 (4 false-positives reclassified via Supabase docs) | Close in Batch B bookkeeping |
| **A3** — DRIFT-L57 (state×surface matrix) | **VIOLATIONS** | 7 dead/orphan values across 5 columns | Hygiene commit OR consolidated DRIFT entry; not security-critical |
| **A4** — DRIFT-L65 (server-only poisoning) | **CLEAN** | 0 | Close in Batch B bookkeeping |
| **A5** — DRIFT-L279 (`'use client'` taint) | **CLEAN** | 0 (2 unused-export drift candidates noted) | Close in Batch B bookkeeping |
| **A6** — NEW-SERVICE-ROLE-GREP | **CLEAN** | 0 | Closure note (no DRIFT entry needed) |
| **A7** — NEW-RATE-LIMIT | **CLEAN with operator-side verification** | 0 | Operator verifies Supabase dashboard defaults; Batch D opens post-launch revisit DRIFT entry |

## Followup recommendations (out of scope for Batch A)

1. **Batch B bookkeeping commit** — close A1 / A2 / A4 / A5 in
   DRIFT_LOG (mark `[x]`, append `Closed: Phase 13 / 13-2 Batch A
   <SHA>`). A6 + A7 don't have DRIFT entries; they live in this
   report as audit deliverables.

2. **A3 hygiene** — open ONE consolidated DRIFT entry
   `state-machine-enum-hygiene` covering all 7 dead/orphan values,
   owner Phase 13 / 13-cross-cutting (low-priority polish; not a
   v1 launch blocker). Batch B / C / D execution at user discretion.

3. **A7 post-launch revisit** — open one DRIFT entry
   `auth-rate-limit-post-launch-revisit` owner post-v1, captured in
   Batch D bookkeeping.

4. **Operator action (out-of-band, not commit-bound)** — user logs
   into Supabase dashboard at
   `/dashboard/project/_/auth/rate-limits` and confirms project
   defaults haven't been disabled. This is a one-line verification,
   not Claude-Code-driveable.

## Branch tip

`c84becd` (no changes from this report — read-only audit only).
