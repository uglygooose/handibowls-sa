# Phase 13 / 13-6 — Scoping

**Branch tip:** `0a8ff7a` (`rebuild/phase-13-launch-prep`).
**Read-only audit.** No code changes. Single audit commit at end carrying this report.
**Scope:** content + copy polish — the catch-all sub-checkpoint where customer-facing words get reviewed before launch.

---

## Plan-vs-13-prep scope reconciliation (read this first)

Two slightly different scopes are in play:

- **Plan §16 step 6 (HANDIBOWLS_REBUILD_PLAN.md:1039-1042) — narrow:**
  > **Content.**
  > - Onboarding checklists per role.
  > - `/help` seed articles: creating a tournament, scoring a match, booking a rink, T20 walkthrough.
- **13-prep locked scope (DRIFT_LOG.md:254) — broader:**
  > **13-6** — content / copy polish (onboarding checklists, /help articles, BSA pass, legal / privacy).

The 13-prep scope adds two items the plain plan text omits: (a) a BSA terminology pass and (b) legal/privacy public surfaces. Both are reasonable v1-launch concerns — BSA terms are how HandiBowls earns trust with the South African bowls community, and legal/privacy public pages are usually a launch checklist item even when the schema-level POPIA work is already done.

The brief that opened this scoping pass listed 8 categories (privacy + terms + /help + onboarding + landing + empty states + email + cookie consent). Per the operating principle "follow the plan — surface the divergence in scoping doc", this scoping document **adopts the 13-prep locked scope (4 items)** as the canonical 13-6 scope and treats the brief's other 4 categories as out-of-13-6 unless explicitly re-locked by the user. Each is acknowledged below with a one-line rationale.

**In-scope for 13-6 (this scoping doc covers):** onboarding · `/help` seed articles · BSA terminology pass · legal/privacy.

**Out-of-13-6 (acknowledged + parked):**
- **Marketing landing copy** — already polished at 13-4 / Batch A (truthfulness rewrite + Twenty 20 reframe + SocialProof repurpose). Further marketing iteration is post-launch.
- **Empty state copy sweep** — 6 `<EmptyState>` callers ship today; copy is already decent. No discovered gap. Optional Batch E in this doc but skip-by-default.
- **Email template content review** — only one custom template exists (`InviteEmail.tsx`). Already touched at Phase 11. Out unless a specific tone/compliance gap surfaces.
- **Cookie consent banner** — POPIA's consent surface for HandiBowls lives on `/me/setup` Step 4 (Consent) + the consents-versioning schema. Cookies for *site analytics* are not in v1 (no Vercel Analytics, no GA, no third-party trackers). No banner needed; documented in legal/privacy copy at Item 3.

---

## Reference inputs surveyed

- `HANDIBOWLS_REBUILD_PLAN.md` §16 step 6 — plan-text scope.
- `DRIFT_LOG.md:254` — 13-prep locked scope; no individual DRIFT entries are owned by 13-6 (zero results for `→ 13-6`).
- `app/(player)/me/setup/_components/{SetupWizard,Step1Identity,Step2Bowls,Step3Contact,Step4Consent}.tsx` — 4-step profile-completion wizard (player onboarding).
- `app/(player)/(gated)/me/settings/data-and-privacy/{page.tsx,_components/}` — POPIA functional surface (Download + Delete affordances) shipped at 13-2b. **Not a privacy policy page** — it's the user-action surface.
- `app/(marketing)/_sections/Footer.tsx` — landing footer. Has `#about` placeholder anchors for "Docs" and "About"; no real legal/privacy/help links wired.
- `lib/email/templates/{InviteEmail,_BaseLayout}.tsx` — only 2 email templates (invite + shared layout). 477 LOC total.
- `components/layout/EmptyState.tsx` — single primitive; 6 consumers across `app/`.
- `app/(public)/email/{layout.tsx,…}` — public route group, currently hosts the unsubscribe surface only.
- Skill: `bsa-terminology` (HandiBowls canonical BSA terms — 20 districts, disciplines, positions, etc.). Already enforced opportunistically in earlier phases; no formal v1 sweep on record.
- Searches confirming **greenfield** for: `/help`, `/support`, `/docs`, `/privacy`, `/terms`, `/legal`, `/about`, admin onboarding, super-admin onboarding.

---

## Item 1 — Onboarding checklists per role

### Current state

| Role | Surface | State |
|---|---|---|
| Player (post-invite, first sign-in) | `/me/setup` | **EXISTS** — 4-step wizard (Identity / Bowls / Contact / Consent). Profile-completion gate; user is redirected here from any gated surface until `profile_completed=true`. Solid coverage of the "fill in your profile" half of player onboarding. |
| Player (post-setup, first /play render) | `/play` Home | **PARTIAL** — Now post-13-4.5 the welcome surface always shows useful content (PlayerHero + 3 stats + Recent Results + Quick Actions). No explicit "you're done with setup, here's what to do next" guidance. |
| Club admin (first sign-in after club creation) | `/manage/overview` | **GREENFIELD** — no welcome banner, no first-time tour, no checklist. First-time admin lands cold. |
| Super admin (first sign-in) | `/platform/clubs` | **GREENFIELD** — no welcome banner, no first-time tour. |

### Decisions needed

- [ ] **D1.1 — Player post-setup onboarding shape.** Three options: (a) Welcome banner on /play after first /me/setup completion (dismissible, shows once); (b) "Getting started" checklist (e.g. "Enter your first tournament", "Score your first match", "Try a Twenty 20"); (c) No additional onboarding — /me/setup + the always-useful /play surface are sufficient. **Recommendation: (c)** — /me/setup completion already orients the user; further first-time-only chrome adds complexity for marginal benefit. Player onboarding closes here.
- [ ] **D1.2 — Club admin onboarding shape.** Three options: (a) Welcome banner with 3-4 next steps (invite members, set up greens, create first tournament); (b) Persistent "getting started" checklist that auto-completes as the admin does each step (visible until 4/4 done); (c) No onboarding — empty-state copy on the empty surfaces is the only guidance. **Recommendation: (b)** — admin role has more setup steps than player; a self-completing checklist gives clear progress without nag fatigue. Scope: 1 component (`AdminGettingStartedChecklist`), surfaces on `/manage/overview` only when at least one of the steps is incomplete. ~120 LOC.
- [ ] **D1.3 — Super admin onboarding shape.** Super-admin is platform-level — typically a single user (Andrew Els initially). Almost no day-to-day onboarding need. **Recommendation: skip for v1.** Empty-state copy on `/platform/clubs` (already exists) covers the lone "no clubs onboarded yet" moment.

### Decisions surfaced: **3 (D1.1, D1.2, D1.3)**.

---

## Item 2 — `/help` seed articles

### Current state

**Greenfield.** No `/help`, `/support`, `/docs`, or `/about` route. Footer's "Docs" and "About" links currently anchor to `#about` (no-op).

### Plan-locked article list (4)

Per HANDIBOWLS_REBUILD_PLAN.md:1042:
1. Creating a tournament
2. Scoring a match
3. Booking a rink
4. T20 walkthrough

### Decisions needed

- [ ] **D2.1 — Route shape.** Three options: (a) `/help` route with 4 child routes `/help/creating-a-tournament` etc. (Next.js conventional, deep-linkable, search-engine-discoverable); (b) Single `/help` page with 4 anchored sections (simpler routing, scrollable); (c) Single `/help` page with accordion (compact, no scroll, deeper interaction). **Recommendation: (a)** — multi-page is the durable pattern; helps SEO (each article as its own crawled page) + lets future support links deep-link to specific articles. Route group `app/(public)/help/[slug]/page.tsx` with markdown-source content. Scope: ~200 LOC infrastructure + per-article content.
- [ ] **D2.2 — Content authoring approach.** Three options: (a) Operator writes all 4 articles, Claude wires the routing; (b) Claude proposes draft content from app understanding, operator reviews + approves + edits in-place; (c) Hybrid — Claude drafts the technical "how it works" sections, operator writes the "voice" / brand tone sections. **Recommendation: (b)** — Claude has detailed visibility into each surface (tournament creation flow, scorecard mechanics, booking actions, T20 capture wizard) and can produce accurate first drafts; operator review + edit is fast vs starting from blank. Operator-side time estimate: ~30-60 min per article reviewed.
- [ ] **D2.3 — Content format.** MDX vs Markdown vs JSX-with-content. **Recommendation: MDX** — keeps content in a markdown-friendly format for non-developer editing while allowing inline React components (e.g. `<Bowl />` mark, `<Image />` screenshots if added later). Next.js 16 supports MDX via `@next/mdx` (would be a net new dep). **Alternative: plain JSX with content inlined** — no new dep, simpler routing, but content edits require JSX comfort. **Counter-recommendation: plain JSX** — for 4 short articles, the MDX setup overhead isn't worth it; if articles grow beyond ~10 down the line, migrate then.
- [ ] **D2.4 — Header/footer navigation wiring.** Footer has `#about` anchors today. Either (a) replace with `/help` link in the existing nav slot; (b) add a small Help icon to authenticated-shell top bar; (c) both. **Recommendation: (a)** — quietest change, matches the existing footer pattern, keeps the authenticated chrome clean. Players + admins discover /help via the footer or by typing the URL.

### Decisions surfaced: **4 (D2.1 - D2.4)**.

---

## Item 3 — Legal / privacy public pages

### Current state

**Greenfield public surfaces.** `/me/settings/data-and-privacy` exists (Download / Delete actions from 13-2b) but is auth-gated and is a *user action surface*, not a *privacy policy text*. No public-readable `/privacy`, `/terms`, `/legal` route. Footer has no legal links.

POPIA-relevant work already shipped (13-2b): consents schema + soft-delete lifecycle + 30-day grace + anonymisation cron + data export endpoint + audit_log retention. The functional compliance is in place; the **textual disclosure** to end-users is what 13-6 ships.

### Decisions needed

- [ ] **D3.1 — Privacy policy authoring approach.** Three options: (a) Bespoke — operator writes the full text from scratch (or with Claude help) tailored to HandiBowls' actual data flows; (b) Template-based — start from a POPIA-compliant SaaS template (e.g. Termly, iubenda, or a free POPIA boilerplate); customise the data-flow specifics; (c) Legal counsel review — operator engages a lawyer to draft or review. **Recommendation: (a) bespoke with Claude scaffolding.** Claude has comprehensive visibility into HandiBowls' data flows (POPIA work was 13-2b; 16-table data export shape is documented; consents versioning is in schema). Bespoke text is more accurate than a template adapted from generic SaaS, and POPIA's notification requirements are not so esoteric that a lawyer review is mandatory for v1. **Operator-side time: ~2-4 hours** to review + edit Claude's draft.
- [ ] **D3.2 — Terms of service authoring approach.** Same options as D3.1. **Recommendation: (a) bespoke** — but with a STRONGER caveat: terms include warranty disclaimer + limitation of liability + governing law clauses that benefit from legal counsel review *before going live with paying customers*. **Recommendation for v1 launch: ship a minimal "acceptable use" terms page (no warranty / liability bombast)** — covers account termination conditions, prohibited use, governing law (South Africa / WCSA jurisdiction). Defer the full counsel-reviewed Terms to post-launch when the first paying customer is on the horizon. Operator-side time: ~1-2 hours for the minimal version.
- [ ] **D3.3 — Where do the pages live?** Two options: (a) Public route group `app/(public)/privacy/page.tsx` + `app/(public)/terms/page.tsx`; (b) Inside the marketing route group `app/(marketing)/privacy/page.tsx` etc. **Recommendation: (a)** — `app/(public)/` already exists for the unsubscribe page; mirroring that pattern keeps the marketing route group focused on landing-page sections. Routes are auth-free, indexable.
- [ ] **D3.4 — Footer + auth-form wiring.** Three places legal pages need to link from: (a) Marketing landing footer (replace `#about` anchors); (b) `/signup` form (POPIA practice — link to privacy policy at signup, possibly with checkbox affirmation); (c) `/me/settings/data-and-privacy` (link upward to the policy from the action surface). **Recommendation: all three.** Scope: small Footer.tsx update + signup form text update + back-link from data-and-privacy page. Combined ~40 LOC.
- [ ] **D3.5 — Company entity name + governing law.** Privacy policy + terms need a controller name + jurisdiction. Three options: (a) "HandiBowls" as a trading name, controller is "Andrew Els (sole proprietor)", governing law: Republic of South Africa (Western Cape jurisdiction); (b) HandiBowls (Pty) Ltd if a company entity exists / will be registered before launch; (c) Defer naming until 13-7 (DNS pointing) when other "production identity" decisions land. **Recommendation: lock at start of Batch C (legal pages execution) — operator decides which entity is the controller before the legal text gets written.**
- [ ] **D3.6 — Cookie language.** Even without Vercel Analytics / GA / third-party trackers, the app DOES set first-party cookies (Supabase auth session, theme preference). POPIA + GDPR practice: disclose first-party cookies in the privacy policy; no separate consent banner needed when cookies are strictly necessary for service operation (auth = necessary; theme = preference, arguably). **Recommendation: disclose in privacy policy section "Cookies and similar technologies" — no banner, no opt-in modal.** Defer cookie banner / consent management to post-launch if/when third-party trackers are added.

### Decisions surfaced: **6 (D3.1 - D3.6)**.

---

## Item 4 — BSA terminology pass

### Current state

`bsa-terminology` skill enforces canonical BSA terms (rink / Skip / Third / Second / Lead / shots up / peel / 20 districts / 5 disciplines etc.). Per-phase greps recommended; no formal v1 sweep on record. Phase 11 + 12.5 + 13-1 all touched user-facing copy and were consistent with BSA terms; no widespread regression risk surfaced.

### Decisions needed

- [ ] **D4.1 — Pass scope.** Three options: (a) Cross-cutting grep + targeted swap of any drift (e.g. "lane" → "rink", "court" → "rink", "ladies" → "Women", "vice" → "third", "points" → "shots"); (b) Surface-by-surface read-through audit with a written report (heavier; surfaces tone issues too); (c) Defer to 13-8 pre-launch QA. **Recommendation: (a)** — grep-based sweep is mechanical, fast, and high signal. Per the bsa-terminology skill's verification block:
  ```bash
  grep -rE "\blane\b|\bcourt\b|\bpitch\b|\bLadies\b|\bpoints\b|\bvice\b" app components --include="*.tsx"
  ```
  Plus the parallel sweep for `\bT20\b` outside file-path/identifier contexts (per skill's nav-level enforcement rule). Surface any hits, fix in single sweep commit.
- [ ] **D4.2 — Output format.** Three options: (a) Single sweep commit with the fixes inline + a brief report comment; (b) Separate audit report committed first to docs/audit/phase-13/13-6-bsa-pass-report.md, then fix commit; (c) Just the fixes, no report. **Recommendation: (c)** — for a mechanical sweep, the diff IS the report. Skip the audit doc unless a non-trivial finding (e.g. dozens of hits suggesting a cross-cutting pattern) warrants standalone documentation.

### Decisions surfaced: **2 (D4.1 - D4.2)**.

---

## Recommended batch shape

Four execution batches + close. Sequencing puts the highest-uncertainty + operator-input-heaviest items first so they don't become end-of-13-6 blockers.

- **Batch A — Legal/privacy public pages.** Ships `/privacy` + `/terms` + footer wiring + signup form + back-link from data-and-privacy. Locked content per D3.1 - D3.6. **Operator-side gating: D3.5 (entity + jurisdiction) + content review of the bespoke text.** Single commit per page if scope holds; combined commit if total LOC < 250. Estimated: 200-400 LOC depending on policy length.

- **Batch B — `/help` route + 4 seed articles.** Plan-locked 4 articles (creating a tournament / scoring a match / booking a rink / T20 walkthrough). Per D2.1 + D2.2 + D2.3, route group + plain-JSX content + footer wiring. **Operator-side gating: D2.2 review pass on each draft article.** May split into B1 (route infrastructure + 1 article) and B2 (remaining 3 articles) if total LOC > 250.

- **Batch C — Onboarding work.** Per D1.2 (admin getting-started checklist). D1.1 + D1.3 default to no-action, so this batch is single-component scope: `AdminGettingStartedChecklist` on `/manage/overview` showing 4 self-completing steps (invite first member / set up greens / create first tournament / send first message). ~120 LOC + 1 component test. Single commit.

- **Batch D — BSA terminology pass.** Per D4.1 + D4.2 (grep-based mechanical sweep + diff-as-report). Estimated: 0-30 LOC depending on what surfaces. Single commit even if zero hits (the commit message documents the clean sweep).

- **13-6 close** — PHASE_LOG entry + DRIFT bookkeeping (no entries to close from 13-6 — none were tagged for it; this sub-checkpoint adds new policy/help/onboarding surfaces rather than closing prior drift) + README state-line update. Single commit.

**Estimated total LOC delta: 400-800 across all batches. Estimated commit count: 5-7.**

---

## Acceptance criteria for 13-6 close

- `/privacy` + `/terms` resolve as public pages with bespoke content covering POPIA disclosure + acceptable-use terms.
- Footer (marketing) + signup form + `/me/settings/data-and-privacy` link to the new legal pages.
- `/help` resolves with 4 published articles (creating a tournament / scoring a match / booking a rink / T20 walkthrough).
- Footer "Docs" anchor replaced with `/help` link.
- Club-admin first-time `/manage/overview` shows a getting-started checklist that auto-completes as steps are done; hides at 4/4.
- BSA terminology grep sweep returns zero unsanctioned hits across `app/` + `components/`.
- All existing test gates green (1390 unit + 170 integration + tsc + lint at 17-warning baseline + next build clean).
- 13-6 close-verify scan against fresh Vercel preview: 0 axe critical / 0 axe serious across the full anchor set + the 6 new pages (`/privacy`, `/terms`, `/help`, `/help/[3 slugs]`).

---

## Operator-side actions banked

- **Legal entity decision (D3.5)** — pre-Batch-A blocker. "HandiBowls (sole proprietor)" vs "HandiBowls (Pty) Ltd" vs deferred to 13-7. Drives the controller name + jurisdiction language in the privacy policy + terms.
- **Privacy policy review** — Claude drafts; operator reviews + edits. Time estimate: 2-4 hours for first pass + revisions. Pre-Batch-A close.
- **Terms of service scope confirmation** — confirm minimal/acceptable-use shape vs full counsel-reviewed terms. Pre-Batch-A close. Recommended: minimal for v1, full at first-paying-customer trigger.
- **`/help` article review** — Claude drafts each of 4 articles; operator reviews + approves. Time estimate: ~30-60 min per article. Spread across Batch B sub-commits if split.
- **Admin onboarding checklist confirmation** — confirm the 4 default steps (D1.2) and acceptance criteria for "step done". Pre-Batch-C kickoff.

---

## Unexpected findings during scoping

1. **Plan §16 step 6 is narrower than the brief's framing.** The plan-text version covers only onboarding checklists + /help articles. The 13-prep close summary (DRIFT_LOG.md:254) added BSA pass + legal/privacy. The brief that opened this scoping pass listed 8 categories. Per operating principle "follow the plan", this scoping doc adopts the **13-prep locked scope** (4 items) and parks the remaining brief-categories explicitly.
2. **Player onboarding is largely already shipped.** `/me/setup` 4-step wizard (Identity / Bowls / Contact / Consent) covers the structurally important new-player flow. /play home is always-useful post-13-4.5. No additional player-side onboarding chrome is needed unless the user wants a "welcome banner" on first /play render.
3. **No DRIFT entries owned by 13-6.** Zero hits for `→ 13-6` in DRIFT_LOG. 13-6's outputs are net-new content surfaces, not drift closures. The close commit will open zero / close zero DRIFT entries by default unless the BSA pass surfaces a previously-unflagged class-of-bug.
4. **`/me/settings/data-and-privacy` is NOT a privacy policy.** It's the POPIA-action functional surface (Download + Delete). Easy to confuse based on filename; flagging here so operator doesn't conflate "we have a privacy thing" with "we have a privacy policy". The policy text is what 13-6 ships.
5. **`/help` deep-link discovery surface.** With Footer wiring as the only entry point, real users may take a while to find /help. Not blocking for v1, but flag for post-launch UX iteration: consider an authenticated-shell help icon at week-2 if support requests warrant.
6. **Cookie consent banner is correctly skipped.** No third-party trackers ship in v1. First-party cookies (Supabase auth session, theme preference) are disclosed in the privacy policy under "Cookies and similar technologies" — no banner / consent modal needed per POPIA practice for strictly-necessary cookies.
7. **No DRIFT entry to track CSP enforcement flip's effect on the new public pages.** When 13-7 flips CSP from Report-Only → enforcing (per `csp-enforcement-flip-13-7`), the new `/privacy`, `/terms`, `/help` pages need to render under the enforcing policy without any new violations. Flagging here so 13-7 includes those pages in the QA cycle.
8. **Footer `#about` anchors are dead today.** Both "Docs" and "About" link to `#about`, which doesn't exist on the page. Visually-broken navigation. Batch B's footer wiring closes this incidental bug as a side effect.

No defamatory or legally-risky claims surfaced. No third-category fictions. No design conflicts.

---

## Decision count summary

| Item | Decisions to lock |
|---|---:|
| Item 1 — Onboarding checklists per role | 3 (D1.1 - D1.3) |
| Item 2 — `/help` seed articles | 4 (D2.1 - D2.4) |
| Item 3 — Legal / privacy public pages | 6 (D3.1 - D3.6) |
| Item 4 — BSA terminology pass | 2 (D4.1 - D4.2) |
| **Total** | **15** |

15 decisions surfaced for user triage before Batch A opens.
