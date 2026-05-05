# DEMO_LOGINS

Operator handoff for the HandiBowls demo Supabase project. Credentials, walk-through script, per-surface hints, reset instructions, manual-verification checklist.

## Honest demo posture

**These accounts and fixtures are seeded for demonstration. Do not seed inflated counts to misrepresent platform traction. Two clubs, fourteen users, ~150 rows. This is the honest demo footprint.**

If a stakeholder asks "how many clubs are on the platform?", the answer is **two** — Demo Bowls Club and Pinelands BC. The product walk-through demonstrates what the app does, not how popular it is. Pilot growth happens post-launch through real onboarding, not seeded fillers.

The seed bakes only the fixtures necessary to reach every state machine (`tournament_status`, `submission_status`, `t20_grade`, `booking_purpose`, `invite_status`, etc.) so each feature has at least one real row to render against. State-machine coverage is the floor; counts do not exceed functional minimums.

## Cloud project

| | |
|---|---|
| Supabase | `crahegkboinnhffabkxc.supabase.co` |
| Vercel preview | `rebuild/phase-13-launch-prep` branch's most recent deploy |

The seed targets the same Supabase project the Vercel preview is wired to via `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` / `.env.test`. There is no production data on this project; the seed's reset script wipes any non-demo, non-reference data on every run.

## Credentials

**Shared password:** `DemoPass2026!` — every account, canonical and filler. Do not reuse this pattern for real users.

### Canonical accounts (7) — the demo walk-through anchor set

| Email | Role | Club | Demo purpose |
|---|---|---|---|
| `super@handibowls.local` | super_admin | none | Platform tour: cross-club view, district scope. |
| `admin@demo.local` | club_admin | Demo Bowls Club | Club admin: tournament management, T20, bookings, messaging. |
| `admin2@demo.local` | club_admin | Pinelands BC | Cross-club isolation demo. |
| `coach@demo.local` | club_admin | Demo Bowls Club | Twenty 20 capture wizard with the in-flight assessment. |
| `captain@demo.local` | player | Demo Bowls Club | Scoring a match as captain (submitted state). |
| `player@demo.local` | player | Demo Bowls Club | Player home, /book, /t20 grade ladder, /me/inbox. |
| `player2@demo.local` | player | Demo Bowls Club | Opposing-captain confirmation flow. |

### Filler members (7) — tournament-team rosters

These accounts populate tournament team rosters with believable position diversity (skip, third, second, lead). Not part of the demo walk-through — the operator does not log in as these. They appear in member lists, team rosters, and as opposing players in match cards.

| Email | Display name | Club | Position |
|---|---|---|---|
| `vee@demo.local` | Vee Veteran | Demo Bowls Club | skip |
| `tee@demo.local` | Tee Third | Demo Bowls Club | third |
| `ess@demo.local` | Ess Second | Demo Bowls Club | second |
| `lee@demo.local` | Lee Lead | Demo Bowls Club | lead |
| `ren@demo.local` | Ren Rookie | Demo Bowls Club | lead |
| `pinplay1@demo.local` | Penny Pines | Pinelands BC | skip |
| `pinplay2@demo.local` | Pat Pinetree | Pinelands BC | lead |

## 1-page demo script

Total walk-through target: **15–20 minutes**. Open with platform context, end on a player's score-a-match flow.

### 1. Super admin tour (~3 min)
Sign in as `super@handibowls.local`.
- `/platform/clubs` — show **2 clubs** across **2 districts** (Boland + Western Province). Honest footprint; pilot scale, not vanity scale.
- `/platform/districts` — show all **20 BSA districts** seeded as reference data (migration 003). Every BSA district is recognised by the platform out of the box.
- `/platform/users` — **14 demo users** total. Search box filters; no pagination on this dataset.
- `/platform/rubrics` — **v1-final-2026** active + **v2-draft-2026** inactive. Open the schema-view modal on each to show the rubric jsonb shape.

### 2. Club admin tour (~6 min — the meat)
Sign out, sign in as `admin@demo.local`.
- `/manage/overview` — getting-started checklist + bookings calendar populated for this week. Audit log shows recent admin actions.
- `/manage/members` — **10 members** at Demo Bowls Club. 4 canonical (admin + coach + captain + 2 players) + 5 filler players + 1 admin assignment. Plus **4 invites** at the bottom: pending, accepted, expired, revoked. Click "Resend" on the expired invite to demonstrate the affordance.
- `/manage/tournaments` — **5 tournaments** covering every status: 1 draft, 1 open (3 entries visible), 1 in_progress (round-robin, 4 teams, 6 matches), 1 completed (Mixed Triples Final, 21–14), 1 cancelled.
- Click into **Autumn Pairs Round-Robin**:
  - Entries tab — 4 teams visible.
  - Draw tab — round-robin schedule rendered.
  - Scoring tab — 1 match in `captain_submitted` state (waiting opposing-captain confirm), 1 in `opponent_confirmed` (waiting admin verify), 1 walkover, 3 scheduled.
  - Audit tab — empty (audit_log retrofit is post-v1; flagged in DRIFT).
- `/manage/messages` — **4 sent + 1 draft**. Click into the "Coach availability — pick a slot" message to show recipient list + read/unread mix.
- `/manage/greens` — 2 greens (Main, South) × 6 rinks total. South 3 is **disabled-for-maintenance**; show the toggle.

### 3. Coach (T20 capture) (~3 min)
Sign out, sign in as `coach@demo.local`.
- `/manage/t20` — **7 assessments** visible across grade × status:
  - 4 submitted at iconic grades (gold, silver, bronze, fail/Reassess) for Pat Player.
  - 1 archived gold (older, archived state).
  - 1 in-flight draft on Cam Captain — **click into it**.
- Capture wizard opens to Section 1 (Jacks), distance 23m. **16 deliveries already captured** across rounds 1+2 to demonstrate live-grade-projection in motion. Tap a few more deliveries in Section 1; the running grade ticker updates.

### 4. Player flow (~4 min)
Sign out, sign in as `captain@demo.local` (the captain demo flow needs this account).
- `/play` — player home with **active match** card (Team A vs Team B, in-progress).
- Tap into the match — scorecard opens. Show wake-lock toggle, wet-hands toggle, per-end grid. The match is currently in `captain_submitted` state from this captain's view.
- Sign out, sign in as `player2@demo.local` (opposing captain).
- `/play` — same match shows in opposing-captain confirmation state. Tap **Confirm** to advance to `opponent_confirmed`.
- Sign out, sign in as `player@demo.local`.
- `/me` — profile, **3 upcoming bookings**, past bookings.
- `/book` — date strip + slot list for the next 14 days. Pick any open slot to show the booking sheet.
- `/t20` — grade ladder showing **Gold** (most recent submitted assessment, 82.6%). Past assessments list visible below.
- `/me/inbox` — **5 notifications** (one per related_kind: message, booking, t20_assessment, match, tournament) + recent messages.

### 5. Cross-club isolation (~1 min)
Sign out, sign in as `admin2@demo.local`.
- `/manage/overview` — Pinelands BC scope. Tournament list shows ONE in-progress tournament (Pinelands Singles 2026), not Demo Bowls Club's 5. Demonstrates `club_id` RLS isolation.

### Wrap (~1 min)
Sign out. Note: production posture is bowls-club-first BSA-aligned tournament management. v1 launch onboards pilot clubs through real demo + real account creation, not seeded fillers.

## Per-surface "show this" hints

One line per surface — point at the feature, not the pixels.

| Surface | Show this |
|---|---|
| `/platform/clubs` | 2 honest clubs + theme-preset diversity (atomic-red Demo, ocean-blue Pinelands). |
| `/platform/districts` | 20 BSA districts seeded out of the box. |
| `/platform/users` | Mixed-role population — super_admin / club_admin / player. |
| `/platform/rubrics` | v1 active + v2 draft; activation is reversible (deactivate / activate buttons). |
| `/manage/overview` | Getting-started checklist + bookings calendar + audit-log trail. |
| `/manage/members` | 10 members + 4 invites covering all 4 invite_status values. |
| `/manage/tournaments` | 5 tournaments × every status; click in to see Entries / Draw / Scoring / Audit tabs. |
| `/manage/tournaments/[id]` (in_progress) | Submission state machine: pending → captain_submitted → opponent_confirmed. |
| `/manage/messages` | Both channels (in-app + email), 3 audience kinds, draft state. |
| `/manage/t20` | Grade × status matrix coverage; click the in-flight draft to open the capture wizard. |
| `/manage/t20/[id]/capture` | 8-wedge compass (sections 3-5), Fore/Back hand toggle, live grade projection. |
| `/manage/greens` | 2 greens × 6 rinks; 1 disabled-for-maintenance affordance. |
| `/play` | Hero match card + recent results strip; Twenty 20 grade pill on /me CTA. |
| Scorecard | Per-end grid, wake-lock + wet-hands toggles, captain-submit + opposing-confirm flow. |
| `/book` | Date strip + slot list for 14 days; weekly availability windows seeded Mon-Sat 09-17. |
| `/me` | Profile + 3 upcoming bookings + past bookings + privacy data-export affordance. |
| `/me/inbox` | 5 notifications across all related_kind routes; mix of read/unread. |
| `/t20` | Grade ladder at Gold (most recent), past assessments below; click any to see results detail. |
| `/help` | 4 plain-text articles covering creating-a-tournament / scoring / booking / Twenty 20. |
| `/privacy`, `/terms` | POPIA-aligned + RSA-Western-Cape governing law. Both reachable from footer. |

## Reset instructions

If the demo state needs resetting mid-session (e.g. operator accidentally cancelled a match they wanted to demo):

```bash
# In the repo root, with .env.test or .env.local pointing at the demo Supabase:
npm run seed:demo:reset && npm run seed:demo
```

Two-stage reset:
- **Stage 1** wipes ANY non-demo data on the project (RLS-test orphans, dev-account leftovers, anything not tagged `demo-` or `pinelands-bc` for clubs / `*@demo.local` or `*@handibowls.local` for users).
- **Stage 2** wipes the prior demo seed's outputs.

Then re-seeds from scratch. Total runtime against cloud: ~30-60 seconds (depending on user-deletion volume).

**Reset preserves:** the 20 BSA districts (migration 003 reference data) + the active v1-final-2026 rubric (migration 013 reference data).

To verify the reseed produced full state-machine coverage:

```bash
npm run seed:demo:verify
```

51 assertions; takes ~15s. Pass = every reachable enum cell has at least one row.

## Operator manual verification checklist

Click through these surfaces before presenting. Order matches the demo script. ~10 minutes if everything renders cleanly.

- [ ] Sign in as `super@handibowls.local` / `DemoPass2026!` — `/platform/clubs` shows 2 clubs.
- [ ] `/platform/users` — 14 users visible across roles.
- [ ] `/platform/rubrics` — schema-view modal opens on both v1-final + v2-draft.
- [ ] Sign in as `admin@demo.local` — `/manage/overview` renders with bookings calendar populated for this week.
- [ ] `/manage/members` — 10 members + 4 invites at the bottom, including 1 expired with "Resend" button.
- [ ] `/manage/tournaments` — 5 tournaments listed, each with a different status badge.
- [ ] Click into Autumn Pairs Round-Robin — Scoring tab shows matches in 3 different submission states.
- [ ] `/manage/messages` — 4 sent + 1 draft; recipient list visible on the "Coach availability" message.
- [ ] `/manage/greens` — South 3 rink shows the disabled-for-maintenance state.
- [ ] Sign in as `coach@demo.local` — `/manage/t20` shows 7 assessments; the in-flight draft opens to a partially-filled capture wizard.
- [ ] Sign in as `player@demo.local` — `/play` shows hero card; `/t20` shows Gold grade ladder; `/me/inbox` shows 5 notifications.
- [ ] Sign in as `admin2@demo.local` — `/manage/overview` shows Pinelands scope only (no Demo BC tournaments visible).

If any surface renders empty or shows an error: stop, run `npm run seed:demo:reset && npm run seed:demo` again, re-check. If it still fails: open a DRIFT entry against the surface; the demo script can route around a single broken page if needed.

## Cloud DB state at the most recent seed

Counts post-seed (verified 2026-05-05). All numbers within ±20% are within tolerance — small variance expected based on which clubs/users are present at reset time.

| Entity | Count |
|---|---|
| clubs | 2 |
| districts | 20 (reference data) |
| greens | 3 |
| rinks | 10 |
| club_memberships | 10 |
| club_admin_assignments | 3 |
| tournaments | 6 |
| tournament_teams | 8 |
| tournament_team_members | 14 |
| tournament_entries | 3 |
| matches | 8 |
| match_ends | 37 |
| bookings | 10 |
| booking_windows | 18 |
| t20_assessments | 7 |
| t20_deliveries | 16 |
| t20_rubric_versions | 2 |
| messages | 5 |
| message_recipients | 12 |
| notifications | 5 |
| invites | 4 |
| auth.users (demo) | 14 |
| **Total fixture rows** | **~167** |

Coverage matrix at most recent seed: **51 / 51** state-machine assertions pass.

Auth verification at most recent seed: **14 / 14** demo accounts authenticate via `signInWithPassword` against the cloud Supabase.

## Future-state note

Post-DNS-cutover, when pilot clubs onboard for real: this demo seed is retired entirely. The demo Supabase project becomes a fresh staging environment for ongoing dev. No schema-migration debt is carried forward from the seed (the seed touches only data, not schema).
