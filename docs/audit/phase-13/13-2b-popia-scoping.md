# Phase 13 / 13-2b — POPIA Compliance Scoping Report

Captured: 2026-05-02
Branch tip at audit: `c2795ff`
Methodology: 2 parallel `Explore` subagent runs (cross-user view inventory + /me surface inventory) + main-thread schema/audit-log/cleanup-mechanism surveys.

This report scopes the POPIA-compliance work that follows the
13-2a close. No code changes, migrations, DRIFT entries opened or
closed — read-only audit only.

---

## 1. Schema impact survey

### 1.1 Profile PII columns

`public.profiles` (migration 002 / `core_identity.sql`):

| Column | PII? | Anonymise on hard-delete? |
|---|---|---|
| `id` (uuid PK; FK → auth.users.id ON DELETE CASCADE) | No | No — opaque UUID survives |
| `role` | No | No — needed for last-super-admin guard |
| `first_name` | **PII** | **NULL** |
| `last_name` | **PII** | **NULL** |
| `display_name` | **PII** | **NULL** |
| `email` | **PII** | **NULL** |
| `phone` | **PII** | **NULL** |
| `gender` | PII (sensitive) | **NULL** |
| `date_of_birth` | **PII (sensitive)** | **NULL** |
| `bsa_number` | **PII (national-ID-class)** | **NULL** |
| `dominant_hand` | Quasi-PII | NULL (low cost) |
| `avatar_url` | PII (image of person) | **NULL** |
| `email_opt_in` | No | No |
| `profile_completed` | No | No (preserve as `false` for POPIA audit trail) |
| `novice_registered_at` | No (date-only) | No |
| `handicap` | No (game stat) | No (preserve for opponent record continuity) |

**New column** for soft-delete model: `deleted_at timestamptz` (nullable). NULL = active; non-NULL = soft-deleted; row anonymised at hard-delete (still non-NULL deleted_at after anonymisation).

### 1.2 Tables with FK → profiles.id

Inventory across all migrations:

| Table.column | FK behaviour | Soft-delete impact | Anonymise impact |
|---|---|---|---|
| `auth.users.id ← profiles.id` | CASCADE | profile cascade-deletes if auth user deletes (existing behaviour stays; POPIA flow is the inverse — soft-delete the profile, then keep auth user disabled or delete via admin API) | n/a |
| `club_memberships.profile_id` | CASCADE | Cascades on profile delete; for soft-delete, we preserve the membership rows so cross-tournament records resolve | Delete on hard-delete (cleanup job) |
| `club_admin_assignments.profile_id` | CASCADE | Same | Delete on hard-delete (last-super-admin guard runs first) |
| `club_admin_assignments.assigned_by` | SET NULL | Already POPIA-friendly — assigned_by becomes orphan-safe | No change needed |
| `tournaments.created_by` | SET NULL | Already POPIA-friendly | No change needed |
| `tournament_entries.profile_id` | SET NULL | Already POPIA-friendly | No change needed |
| `tournament_team_members.profile_id` | **RESTRICT** | Hard-delete blocks if user has historical team-member rows. Anonymise pattern requires keeping the row + nulling ON THE PROFILES TABLE, not deleting team_members. | **Critical:** keep the FK pointing at the anonymised profile row; do NOT delete team_members rows |
| `match_ends.submitted_by` | SET NULL | OK | No change |
| `messages.sender_id` | SET NULL | OK | No change |
| `message_recipients.profile_id` | CASCADE | Cascades; on hard-delete (anonymise) the messages stay (FK → messages.id, separate); recipient rows go away with their parent profile | Delete on hard-delete |
| `notifications.profile_id` | CASCADE | Cascades; user's own notification stack purges on delete | n/a |
| `consents.profile_id` | CASCADE | **POPIA-critical:** consent records SHOULD be retained for 7 years per POPIA Section 23(2)(c) — currently they cascade-delete with the profile. Need RLS / retention policy update to preserve consent records past hard-delete (paired with profile anonymisation). |
| `t20_rubric_versions.created_by` | SET NULL | OK | No change |
| `t20_rubric_versions.activated_by` (migration 042) | SET NULL | OK | No change |
| `t20_assessments.profile_id` | **RESTRICT** | Same as team_members — keep the row + null PII on profiles | **Critical:** preserve assessment + anonymise |
| `t20_assessments.assessor_id` | **RESTRICT** | Same | **Critical:** preserve + anonymise |
| `bookings.booked_by` | SET NULL | OK | No change |
| `bookings.for_profile_id` (added by 037) | SET NULL | OK | No change |
| `invites.invited_by` | SET NULL | OK | No change |
| `invites.accepted_profile_id` | SET NULL | OK | No change |
| `audit_log.performed_by` | SET NULL | OK | No change (audit-trail preservation requirement) |

**Pattern:** the RESTRICT FKs (`tournament_team_members`, `t20_assessments × 2`) are the cross-user-record-continuity backbone. The anonymise-not-delete decision means we never delete profile rows — we null PII columns and leave the row + UUID intact, so RESTRICT FKs continue to resolve.

### 1.3 RLS impact

For `profiles` itself: every existing RLS policy needs a `deleted_at IS NULL` clause on the user's own self-read path (so soft-deleted users see no data). Cross-user reads (admin views, opponent name lookups) should continue to read soft-deleted rows because they need the anonymised name to render "Deleted player".

For `consents`: needs a retention exception — soft-delete + anonymise should preserve the consent rows themselves (stripped of profile-FK denormalisation), but the cascade FK on `profile_id` makes that hard. Recommend altering `consents.profile_id` from `CASCADE` to `SET NULL` in the migration so consent records survive profile anonymisation (audit-trail-preserving pattern matching `audit_log.performed_by`).

For dependent tables that don't have the soft-delete-filter requirement (because they're admin / cross-user views), no RLS change needed — the existing club-scope policies cover them.

---

## 2. Audit_log inventory

Schema (migration 031 / `audit_log_and_admin_force_cancel.sql`):

```sql
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid not null,
  action text not null,
  reason text,
  payload jsonb,
  performed_by uuid references public.profiles(id) on delete set null,
  performed_at timestamptz not null default now(),
  /* CHECK constraints on table_name + action non-empty + reason length */
);
```

**No `retention_category` column exists.** The migration 043 schema work needs to add it.

**Cloud row count + age (via Supabase MCP):**
- Total rows: **332**
- Oldest: 2026-04-29 (4 days ago)
- Newest: 2026-05-02 (today)
- Rows older than 30 days: **0**
- Distinct actions: 4

**Action distribution:**
| Action | Count | Proposed retention category |
|---|---:|---|
| `force_cancel_booking` | 161 | `operational` (30 days) |
| `invite_accepted_existing_user` | 66 | `compliance` (7 years — invite acceptance is the consent-capture event) |
| `invite_accepted_new_user` | 66 | `compliance` (7 years) |
| `force_state_change` | 39 | `operational` (30 days) |

**Backfill complexity: trivial.** Only 332 rows, only 4 distinct actions; the migration can include a single UPDATE statement mapping each action to its retention category.

**Future actions that will need categorisation:**
- `activate_rubric_version` (Batch C) — `compliance` (rubric activation gates assessment scoring)
- `delete_account_requested` / `delete_account_executed` (this batch) — `compliance`
- `data_export` (this batch) — `compliance`
- Any future payment-related action — `financial` (also 7 years)

**Recommendation:** add `retention_category text` column with CHECK constraint `('operational', 'compliance', 'financial')` and default `'operational'` (safe default — operational rows expire after 30 days; missing categorisation defaults to least-retentive bucket, which is the right side of the conservative line). Backfill the 4 known action types in the same migration.

---

## 3. Cleanup-job mechanism survey

### 3.1 Available mechanisms

**pg_cron** — installed_version: `null`, default_version: `1.6.4`. **Available but not yet enabled** on the Supabase project. Enabling is a one-line `create extension if not exists pg_cron` in a migration; Supabase grants the necessary permissions automatically.

**Vercel Cron** — no `vercel.json` exists in the repo, no cron jobs configured. Vercel's free tier offers 2 cron jobs/day, Pro tier offers unlimited. Cron jobs hit a webhook (e.g. `/api/cron/cleanup`); Vercel signs the request with a secret token the route validates.

**Supabase Edge Functions** — `supabase/functions/` does not exist; no edge functions deployed. Deno-based serverless; can be invoked via Supabase Cron (built on pg_cron + pg_net).

**pg_net** — `installed_version: null`, `default_version: 0.20.0`. Available, not enabled. Async HTTP from inside Postgres; useful if cleanup jobs need to call back to the app.

### 3.2 Recommendation per job

| Job | Mechanism | Rationale |
|---|---|---|
| 30-day soft-delete → hard-delete (anonymise PII columns) | **pg_cron** | Pure SQL: `update profiles set first_name=null, ... where deleted_at < now() - interval '30 days'`. Atomic, no network round-trip, no auth surface to defend, runs even if Vercel deploy is down. Idempotent (re-running on already-anonymised rows is a no-op). |
| audit_log retention enforcement (delete operational rows >30 days, preserve compliance/financial) | **pg_cron** | Same reasoning. `delete from audit_log where retention_category='operational' and performed_at < now() - interval '30 days'`. Trivially incremental, runs nightly. |

**Recommendation:** enable `pg_cron` in Batch E's migration 043 alongside the schema additions. Schedule both jobs as part of Batch G's migration (or 043 with the schedule statements gated on `pg_cron` extension being created).

**Why not Vercel Cron for these jobs:** the operations are pure-DB and pg_cron is simpler — no need for an `/api/cron/<job>` route that authenticates Vercel's signature, no risk of a deployment outage skipping a cleanup, no rate limits to worry about. Vercel Cron is the right tool when the job needs HTTP egress (e.g. emailing a user that their account is about to hard-delete), which this batch's locked decisions don't require for v1.

### 3.3 Future-Vercel-Cron candidate

The 13-day-mark hard-delete-warning email (if the user wants one) WOULD be the right Vercel Cron use case — it sends Resend mail, which lives outside the database. Not in v1 scope per locked decisions; flagged for post-launch polish.

---

## 4. Cross-user view inventory

(Subagent A: 14 surfaces audited across 6 domains; full report below.)

### 4.1 Verdict breakdown

| Verdict | Count | Examples |
|---|---:|---|
| HANDLES-NULL | 9 | AssessmentCard, AssessmentResults, CaptureWizard, PlayerResultsView, T20 list, AuditLogPanel, MembersTable, AdminsTab, UsersTable, RubricsClient |
| NEEDS-FALLBACK | 1 | BookingsCalendarGrid (booker_name rendered directly on chip, no nullability guard) |
| AMBIGUOUS | 1 | BookingDetailSheet (depends on data layer fallback; needs visual review) |
| NOT-IMPLEMENTED | 1 | Tournament AuditTab (stub, future work) |
| SAFE (no PII) | 2 | Messaging InboxLists (system strings), tournament MatchCard (team names from `tournament_teams`, not profiles) |

### 4.2 Existing fallback patterns

The codebase already has scattered `nameOf()` / `bookerName()` helpers that return `null` when all name fields are null + per-component fallbacks ("Unknown player" / "Unknown admin" / "—"). Pattern is consistent within each surface but the literal string varies.

### 4.3 Anonymisation rendering recommendation

**Centralise into a single `lib/format/profile-display.ts` module:**

```ts
export type ProfileForDisplay = {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  deleted_at?: string | null;
};

export function formatPlayerName(p: ProfileForDisplay | null | undefined): string {
  if (!p) return "Deleted player";
  if (p.deleted_at) return "Deleted player";
  if (p.display_name) return p.display_name;
  const composed = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return composed || "Unknown player";
}
```

Note the difference between "Deleted player" (PII anonymised; user actively chose deletion) and "Unknown player" (data integrity issue; user never had names captured — older/seeded rows). Both are recoverable to an active user via a re-fetch but the strings encode different states.

**Adopt across:** MembersTable, AdminsTab, UsersTable, AuditLogPanel, BookingsCalendarGrid, AssessmentCard / Results, RubricsClient, plus the AMBIGUOUS BookingDetailSheet after audit. Scope: M (~150 LOC across 10+ files; mostly mechanical replace-with-import).

---

## 5. Existing /me surface inventory

(Subagent B: full report below; key findings condensed here.)

### 5.1 Section layout (top → bottom, /me page.tsx)

1. **Profile Hero** (PlayerHero with avatar, name, BSA #, primary club, grade pills)
2. **Stats Strip** (3-column: matches / win rate / clubs)
3. **Inbox preview** (3 recent notifications + "View all" → /me/inbox)
4. **My Bookings** (full variant, upcoming matches/bookings)
5. **Your Clubs** (membership cards, primary badge, disabled "Join another club")
6. **Settings** (4 stub rows + "More settings coming soon" footer)

### 5.2 Settings status

Stub. Four `<SettingRow>` items (Personal details / Notifications / Wet hands default / Account), all non-clickable, trailing values "—" or "Auto". Footer "More settings coming soon." Phase 8a-planned per inline comment. Account row is the semantic home for POPIA affordances.

### 5.3 Recommended placement

**Option A — `/me/settings` sub-route + `/me/settings/data-and-privacy` deep link** for the Export + Delete affordances. Rationale:

- /me already has a `/me/inbox` sub-route — the Settings sub-route mirrors that pattern.
- The 4-row stub list is cramped at /me's mobile width; adding 2 destructive rows inline crowds the surface and risks accidental discovery.
- High-stakes destructive actions benefit from a dedicated page layout (room for confirmation copy, grace-window state, error fallbacks).
- Sub-routing keeps the danger affordances behind intentional navigation.

### 5.4 Confirmation primitives available

- **shadcn AlertDialog** (`components/ui/alert-dialog.tsx`, Phase 12.5 / 12.5-3) — destructive-confirmation pattern; recommended for "Delete my account".
- **shadcn Dialog** (`components/ui/dialog.tsx`, Phase 13 / 13-1 / 8b) — informational modals; recommended for "Export ready" success state.
- **Sheet** (`components/ui/sheet.tsx`) — side-drawer, not currently used on /me; not needed.

### 5.5 Copy tone samples

- Empty inbox: `"No notifications yet. Match reminders, draws, and announcements land here."` (conversational lowercase)
- Settings stub footer: `"More settings coming soon."` (brief, soft)
- Inbox preview action: `"3 unread"` / `"View all"` (imperative micro-copy)
- Stats labels: `"Matches"` / `"Win rate"` / `"Clubs"` (terse nouns, display font)

POPIA copy should match: lowercase descriptions, imperative CTAs, no legalistic phrasing in body copy (the consent flow at `Step4Consent.tsx` already does the legal lift).

### 5.6 Mobile considerations

- Outer wrapper is `max-w-3xl px-4 pb-24` — confirmation dialogs use fixed positioning + z-50 + Radix portal so they overlay correctly.
- AlertDialogAction / Cancel buttons are 48px tap targets out of the box (shadcn defaults align to Material guidelines).
- No sticky headers on /me itself; dialogs float center-screen without z-index conflict.

---

## 6. Existing test coverage

| Concern | Coverage today | Notes |
|---|---|---|
| `profiles.deleted_at` filtering | **0 tests** | Column doesn't exist yet. |
| Cross-user "Deleted player" rendering | **0 tests** | Helper doesn't exist yet. |
| Account-deletion server action (request + execute) | **0 tests** | Action doesn't exist yet. |
| `/api/me/export` JSON endpoint | **0 tests** | Endpoint doesn't exist yet. |
| audit_log retention semantics | **0 tests** | Categorisation column + cron jobs don't exist yet. |
| /me-area component tests | Layout primitives only (PlayerHero, PlayerSectionHead, MobileTabBar, NotificationsBell, PlayerBottomNav). No /me page-level test, no settings-area test. |
| Last-super-admin guard | **0 tests** | Guard doesn't exist yet. |

**Net new test work for 13-2b:** RLS integration (soft-delete filter + cross-user anonymise), action integration (delete request, delete execute via cron, export endpoint), cron-job behaviour test (mock `now()` advance via SET LOCAL), unit/component for the new UI surface (settings page render, AlertDialog interaction, error states).

Estimate: ~25 new test cases across unit + integration. Will move suite from 1376 unit / 136 integration to ~1390 / ~155 (rough).

---

## 7. Proposed batch structure

### 7.1 Batch breakdown

| Batch | Title | Migration | LOC est | Commits est | Dependencies |
|---|---|---|---:|---:|---|
| **E** | Schema — soft-delete + audit retention + pg_cron | **043** | ~150 (SQL+types) | 1 (atomic per L55) | None |
| **F** | RLS + tests — soft-delete filter + cross-user anonymise + retention behaviour | None | ~400 (RLS policy updates + 12-15 RLS test cases) | 2-3 (split per surface family if >250 LOC) | E applied to cloud first |
| **G** | Endpoints + cron jobs — `/api/me/export`, requestAccountDeletion / restoreAccount, last-super-admin guard, pg_cron schedules for hard-delete + audit retention | None (cron schedules in 043 OR a separate 044 if user wants the schedules deferred) | ~500 (server actions + API route + cron procs) | 3 (request action / execute cron / export endpoint each atomic) | E + F |
| **H** | UI — `/me/settings` + `/me/settings/data-and-privacy` + cross-user "Deleted player" sweep + `formatPlayerName` helper | None | ~600 (new sub-route + 10-12 surface adoptions) | 2-3 (sub-route + helper sweep separate) | G |
| **Close** | 13-2b PHASE_LOG entry + DRIFT closures + new entries + README state-line | None | ~50 (markdown only) | 1 | E + F + G + H |

**Total estimate:** ~1700 LOC across **9-12 atomic commits**, ~5-6 working days at the Batch B/C cadence.

### 7.2 Where the two-commit rule applies

Batch E is migration-only by construction. Batch F's RLS policy updates depend on `profiles.deleted_at` existing in the cloud schema, so F must follow E's cloud-apply confirmation. Batch G's endpoints depend on F's RLS being in force (the export endpoint must respect the filter; the request-deletion action writes the `deleted_at` column F's policies filter on). Each of these is a clean two-commit boundary.

### 7.3 Test count delta projection

- Batch E: 0 (schema-only commit; types regen doesn't add tests)
- Batch F: +12-15 RLS integration cases
- Batch G: +5-7 action / endpoint integration cases + 1-2 unit cases
- Batch H: +3-5 component test cases (SettingsPage render, AlertDialog interactions, formatPlayerName helper unit)
- **Total: ~+22-28 cases.** Suite moves from 1376 / 136 → ~1395 / ~158.

---

## 8. Design checks needed before execution

The locked decisions cover most of the surface area. Three real ambiguities to resolve before Batch E lands:

### 8.1 `consents.profile_id` cascade behaviour

**Locked decision says:** "7 years for super_admin compliance + financial records".
**Schema reality says:** `consents.profile_id` is currently `ON DELETE CASCADE` (migration 012 line 7) — so deleting a profile cascades-deletes all the user's consent records, which directly contradicts the 7-year retention.

Two options:
- **(a)** Alter the FK in migration 043 from CASCADE to SET NULL. Consent rows survive profile anonymisation; the user's PII is gone but the "user X consented to T&Cs version Y on date Z" record persists with `profile_id IS NULL`. POPIA-defensible.
- **(b)** Leave CASCADE and trust the anonymise-not-delete model: we never actually delete the profile row, just NULL its PII columns. Cascade never fires. Consent records survive intact.

**Recommendation: (b) — anonymise-not-delete is the load-bearing pattern; leaning on it for consents is consistent with the rest of the schema. No FK change needed in 043.** Document the choice in the migration header.

**Question to confirm:** does the user agree with (b), or prefer (a) for explicit POPIA-defensibility?

### 8.2 `auth.users` row at hard-delete

The locked decision describes anonymising the `profiles` row but doesn't specify what happens to the underlying `auth.users` row. Options:
- **(a)** Delete the auth.users row at hard-delete. Cascade fires through `profiles.id ON DELETE CASCADE` → except we WANT the profile row to survive (anonymised). Direct conflict.
- **(b)** Leave the auth.users row in place but disable login. Supabase's `auth.admin.updateUserById({ban_duration: 'none'})` or set the password to an unknown value. Profile row survives anonymised; user can never log back in.
- **(c)** Delete the auth.users row but break the cascade — ALTER `profiles.id` FK to ON DELETE SET NULL (currently CASCADE). Auth row gone, profile row survives anonymised with a NULL `id` reference... except `profiles.id` is also the PK so it can't go NULL.

**Recommendation: (b) — keep the auth.users row + ban it.** The cleanup pg_cron job calls a SECURITY DEFINER function that:
1. NULLs the PII columns on profiles
2. Calls `auth.admin.updateUserById(user_id, { banned_until: 'infinity' })` (or sets `auth.users.banned_until = 'infinity'` directly via the service-role client invoked from a Vercel Cron — this is the only place pg_cron alone isn't enough).

This is the one place the locked "pg_cron only, no Vercel Cron" recommendation has a wrinkle. The hard-delete cron job needs to either:
- Hit the Supabase Auth Admin API via pg_net (HTTP from Postgres — fragile but possible), OR
- Be split: pg_cron handles the SQL (NULL PII columns), Vercel Cron handles the auth.users ban via a `/api/cron/anonymise-pending` endpoint that calls the Supabase Admin API.

**Question to confirm:** does the user accept the hybrid model (pg_cron SQL + Vercel Cron auth.users ban), OR prefer the pg_net-from-pg_cron all-Postgres model?

### 8.3 `/me/setup`'s consent-capture interaction with deletion

Step 4 of `/me/setup` captures consent to T&Cs + privacy policy. If a user soft-deletes their account, then signs back in within the 30-day grace window (locked decision: deletion is reversible), the consent records survive (per 8.1 above). Do they need to re-consent on restore, or is the original consent timestamp + version still valid?

**Recommendation:** original consent stays valid through the grace window — restoration is a continuation of the same legal relationship, not a new one. The `/me/setup` wizard runs once per profile; restored profiles skip it.

**Question to confirm:** does the user agree, or want a "re-consent after grace" UX?

---

## 9. Out-of-scope notes (flagged but deliberately deferred)

- **13-day hard-delete-warning email.** A "your account will be hard-deleted in 17 days" Resend email at the 13-day mark would be a UX win. Locked decisions don't include it; flagged as post-launch polish.
- **Bulk-export per club admin.** Club admins might want a "export this club's roster as JSON/CSV" affordance (e.g. for archival). Out of POPIA scope (not a personal-data-portability requirement) and post-v1.
- **Audit_log row visibility for deleted users.** When a deleted user's `audit_log.performed_by` is non-null but the profile is anonymised, super-admin views render "Deleted player" via the `formatPlayerName` helper. No additional DRIFT.
- **Real-time soft-delete propagation.** A user soft-deletes → they're still signed in elsewhere → that other tab continues to function. Acceptable for v1 (sessions expire on next refresh; cookie-bound RLS picks up the deleted_at filter on the next request). Not introducing a Supabase Realtime watcher for `deleted_at` flips.

---

## 10. Subagent reports (full output)

### 10.1 Cross-user view inventory (Subagent A)

(Full text condensed into § 4 above. Headline numbers: 14 surfaces audited, 9 HANDLES-NULL, 1 NEEDS-FALLBACK (BookingsCalendarGrid), 1 AMBIGUOUS (BookingDetailSheet), 1 NOT-IMPLEMENTED (tournament AuditTab stub), 2 SAFE.)

### 10.2 /me surface inventory (Subagent B)

(Full text condensed into § 5 above. Recommendation: Option A `/me/settings` sub-route, AlertDialog for delete confirmation, mirror conversational lowercase tone of existing /me copy.)

---

## 11. Branch tip + readiness

Branch tip: `c2795ff`. No changes from this report — read-only audit only.

Standing by for design-check responses on §§ 8.1 / 8.2 / 8.3, then Batch E (migration 043) opens.
