# Phase 13 / 13-5 — Scoping

**Branch tip:** `c5d8fa2` (`rebuild/phase-13-launch-prep`).
**Read-only audit.** No code changes. Single audit commit at end carrying this report.
**Scope:** Sentry init (browser + server/edge SDK + source maps) + Sentry CSP report-uri extension (closes `csp-authenticated-surface-violation-capture`) + Better Stack uptime monitoring + audit-log error telemetry decision. Supabase log drain DEFERRED to post-launch (Hobby tier doesn't expose drains; Pro upgrade only when usage warrants — user-locked).

---

## Reference inputs surveyed

- `next.config.ts` — current CSP directives (Report-Only mode from 13-2a / Batch D-CSP); source-map / Sentry config absent
- `app/layout.tsx` — root metadata + viewport; no Sentry SDK imports
- `package.json` — `next: 16.2`; **no `@sentry/*` deps installed**, no `@logtail/*`, no `@better-stack/*`
- `app/instrumentation.ts` / `instrumentation-client.ts` — **NOT PRESENT** (Next.js conventional files); this is the canonical Sentry init point per Sentry docs
- `middleware.ts` — **NOT PRESENT** (auth + role gating live in layouts via `requireRole()`, not middleware)
- `app/api/**` — exactly 2 routes: `/api/cron/anonymise-pending` + `/api/me/export`. **No `/api/health` endpoint.**
- `supabase/migrations/20260429000011_031_audit_log_and_admin_force_cancel.sql` — `audit_log` table exists (generic table_name + row_id + action + actor + reason; written from RPCs like `cancel_own_booking`, `admin_force_cancel_booking`, `activate_rubric_version`, `popia_anonymise_pending_run`, `popia_audit_retention_run`)
- `console.error` usage across `app/` + `lib/` — 10+ files; existing error logging is `console.error` only, no telemetry forwarding
- DRIFT_LOG entries:
  - `csp-authenticated-surface-violation-capture` (opened at 13-2a / Batch D-CSP — closes when Sentry CSP report-uri lands at 13-5)
  - `audit-log-error-telemetry` (re-tagged from Phase 12 to 13-5 at 13-prep)
  - `server-action-rate-limit-monitoring` (Phase 14 / post-launch watch — Sentry-data-driven decision)
- Context7 docs surveyed: `/websites/sentry_io_platforms_javascript_guides_nextjs` + `/websites/betterstack_uptime`

---

## Item 1 — Sentry browser SDK

### Current state

**Greenfield.** No `@sentry/nextjs` package, no `instrumentation-client.ts` file. The package needs install + config + a DSN env var.

### Canonical pattern (per Sentry docs, current SDK)

The browser SDK init lives in `instrumentation-client.ts` at app root (Next.js 15+ pattern; replaces the older `sentry.client.config.ts` name). Standard init shape:

```ts
// instrumentation-client.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,                    // POPIA: flip default OFF
  tracesSampleRate: ... ,
  integrations: [...],
  replaysSessionSampleRate: ... ,
  replaysOnErrorSampleRate: ... ,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

### Decisions needed

- [ ] **D1.1 — Wizard-driven vs hand-rolled setup.** `npx @sentry/wizard@latest -i nextjs` auto-creates the four config files + adds `withSentryConfig` to next.config.ts + injects env var stubs. Saves ~30 min of plumbing but the wizard's defaults include `sendDefaultPii: true` (POPIA-incompatible) and `replayIntegration()` (bandwidth-heavy + surveillance-adjacent). **Recommendation: hand-rolled.** We get explicit control over the POPIA-relevant defaults; the wizard's value is mostly time-savings on a one-time setup that we'd then audit-and-tighten anyway.
- [ ] **D1.2 — `tracesSampleRate` for v1.** Sentry default suggestion: 1.0 in dev, 0.1 in prod. v1 is low-traffic; 1.0 in prod could quote-eat fast at scale but for the launch month's volume should be safe. **Recommendation: 1.0 in dev / 1.0 in prod for the first month** (full visibility during launch), revisit at the 30-day mark if quota usage warrants tapering to 0.1-0.2.
- [ ] **D1.3 — Replay integration enabled?** Sentry Replay records DOM mutations + user interactions for post-mortem replay of error sessions. Bandwidth cost (~50KB per minute), surveillance-adjacent (POPIA implications even with `maskAllText: true` + `maskAllInputs: true`), worth-it ratio depends on whether we'll actually triage replays during incidents. **Recommendation: OFF for v1.** The bowl-mark + score-sheet flows are tight enough that error stack traces + breadcrumbs should be sufficient diagnostic data; revisit if a real incident reveals a gap.
- [ ] **D1.4 — `beforeSend` ignore list.** Standard Sentry recommendation: filter ResizeObserver loop limit warnings, browser extension errors, network errors from blocked third-party requests. Adds ~30 lines to instrumentation-client.ts. **Recommendation: ship with the standard ignore list** (Sentry publishes a community baseline); refine reactively if real noise surfaces in the dashboard.
- [ ] **D1.5 — `BrowserTracing` integration enabled?** Captures pageload + navigation performance traces, fetch/XHR spans. The `tracesSampleRate` decision in D1.2 governs whether traces are sent at all. BrowserTracing is auto-included when tracesSampleRate > 0. **Recommendation: ON (auto-enabled when D1.2 > 0).** No explicit decision needed if D1.2 ≥ 0.1.

---

## Item 2 — Sentry server / edge SDK

### Current state

**Greenfield.** `instrumentation.ts` at app root is the Next.js conventional hook; absent today. Sentry docs canonical shape:

```ts
// instrumentation.ts
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
```

Plus `sentry.server.config.ts` + `sentry.edge.config.ts` companion files with `Sentry.init({ dsn, sendDefaultPii: false, tracesSampleRate, ... })`.

### Decisions needed

- [ ] **D2.1 — `tracesSampleRate` for server/edge.** Same considerations as D1.2 but the volume profile differs (server traces include every Server Action + RPC call). **Recommendation: same as browser — 1.0 in dev / 1.0 in prod for the launch month, taper if needed.**
- [ ] **D2.2 — Ignore expected RLS-denial errors.** `requireRole()` redirects + RLS denial paths are not bugs; they're security working as intended. Capturing every "user tried unauthorised action" event would add noise. **Recommendation: filter `Error: Not authenticated` + `PostgresError 42501` (insufficient_privilege) + `redirect()` thrown errors at the SDK level via `beforeSend`.** ~10 lines.
- [ ] **D2.3 — Edge runtime relevance.** Per Vercel knowledge update, Edge Functions are deprecated; v1 doesn't currently use edge runtime explicitly. The `sentry.edge.config.ts` file is harmless to include (Sentry imports it conditionally) but isn't load-bearing today. **Recommendation: ship the file for completeness** so future edge route handlers (if any) land instrumented.

---

## Item 3 — Sentry source maps

### Current state

**Greenfield.** `next.config.ts` is currently wrapped only by `withSerwist`; no `withSentryConfig`. Source maps are not uploaded to Sentry, which means production stack traces are minified Next.js chunks (essentially unreadable).

### Mechanism

Sentry's `withSentryConfig` (wrapping next.config.ts) uploads source maps to Sentry at build time via `sentry-cli`, requiring:
- `SENTRY_AUTH_TOKEN` env var at build time (Vercel project env)
- `org` + `project` slugs in the wrapper config

### Decisions needed

- [ ] **D3.1 — Enable source map upload from day one or defer to post-launch?** Pros: full debuggability in Sentry from first error onward. Cons: every Vercel build calls `sentry-cli` (~30s build-time cost), uses Sentry's source-map storage quota (small but non-zero), requires the auth token to be set on Vercel before the next deploy succeeds. **Recommendation: enable from day one.** The build-time cost is small relative to the Lighthouse build's ~3min; debuggability without source maps is severely degraded. Operator-side: `SENTRY_AUTH_TOKEN` env var goes into Vercel before Batch B ships.

---

## Item 4 — Sentry CSP report-uri integration

### Current state

`next.config.ts:55-67` builds the CSP directive list but does not include `report-uri` or `report-to`. Mode is `Content-Security-Policy-Report-Only` (line 78). Browser logs violations to console only — no centralised observation.

The next.config.ts comment at line 36 explicitly anticipates this: *"Sentry (deferred to 13-5; that commit extends connect-src)."*

DRIFT entry `csp-authenticated-surface-violation-capture` (opened at 13-2a / Batch D-CSP) tracks the "wire Sentry's report-uri so authenticated surfaces report violations" close-out.

### Mechanism

Sentry hosts a CSP-violation collector at:
```
https://<region>.ingest.sentry.io/api/<project_id>/security/?sentry_key=<public_key>
```

The `<region>` + `<project_id>` + `<public_key>` are derived from the same DSN used by the browser/server SDK. Adding `report-uri <url>` to the CSP directive list lands violations in the same Sentry project as runtime errors — single dashboard, single auth.

CSP also needs `connect-src` extended with the Sentry ingest host for the runtime SDK's HTTP POST of error events.

### Decisions needed

- [ ] **D4.1 — Sentry-hosted report-uri vs self-hosted forwarder.** Self-hosted means an `/api/csp-report` route that receives violation reports + forwards to Sentry. Adds 1 route handler + retains control over what's forwarded (e.g. drop benign noise before sending). Sentry-hosted is simpler (no app-side code), but every browser violation report goes straight to Sentry quota. **Recommendation: Sentry-hosted for v1.** Self-hosted is over-engineering for current scale; if Sentry quota becomes a concern post-launch, swap then.
- [ ] **D4.2 — Migrate `report-uri` to `report-to` (modern spec)?** `report-uri` is deprecated in CSP3 in favour of the `report-to` directive (which uses a Reporting-Endpoints HTTP header to define group names). Browser support is mixed — Chrome/Edge support both, Firefox only `report-uri` reliably. **Recommendation: ship both** — `report-to` for forward-compat + `report-uri` for browsers that haven't migrated. Sentry accepts both shapes against the same endpoint.

---

## Item 5 — PII scrubbing for POPIA compliance

### Current state

**Greenfield.** Sentry's `sendDefaultPii` is `true` by default (sends user IP, request headers). Without explicit scrubbing, runtime errors will carry:
- User IP address (in `request.ip` and `user.ip_address`)
- Request headers (Authorization, Cookie may be auto-stripped by Sentry but custom headers aren't)
- Request body for Server Actions (if SDK captures fetch payloads)
- `user.email` if set via `Sentry.setUser({ email })`

POPIA's "minimum necessary processing" principle + the existing 13-2b deletion lifecycle (PII gets nulled at anonymise time) imply Sentry events shouldn't carry PII in the first place.

### Decisions needed

- [ ] **D5.1 — `sendDefaultPii`: ON or OFF?** **Recommendation: OFF** for both browser + server. Locks down IP + headers + auto-PII at the SDK level. Sentry's stack traces + breadcrumbs + custom event tags still give us 95% of triage value without the PII surface.
- [ ] **D5.2 — `Sentry.setUser()` policy.** When the user is logged in, do we set `Sentry.setUser({ id: user.id })`? (No email, no IP — just opaque profile UUID.) **Recommendation: YES, id-only.** Lets us correlate errors per-user across sessions for triage; profile UUID isn't PII (it's a random opaque identifier). Don't set email or any other field. Apply via a small helper called from the auth listener.
- [ ] **D5.3 — Request body capture for routes touching PII.** Sentry can capture fetch/Action POST bodies when `sendDefaultPii: true`; with `false` it doesn't, so D5.1 already covers most of this. Belt-and-braces: explicitly `beforeSend` filter that nulls `event.request.data` for routes matching `/api/me/export`, `/api/cron/anonymise-pending`, any auth route, and Server Actions touching `profiles` / `consents` / `email` / `bsa_number`. **Recommendation: implement the belt-and-braces filter.** ~15 lines; covers the case where a future contributor flips `sendDefaultPii: true` and forgets the PII implications.

---

## Item 6 — Better Stack uptime monitoring

### Current state

**Greenfield.** No external uptime monitor configured. App is currently observable only via direct Vercel deployment status (which doesn't probe runtime health, only build status).

### Mechanism

Better Stack uptime monitors are configured via dashboard or `POST /api/v2/monitors`. Each monitor specifies:
- `monitor_type` (e.g. `"status"` for HTTP)
- `url` (the URL to ping)
- `pronounceable_name`
- `check_frequency` (seconds; **3min = 180s on free tier**, 30s on paid)
- Alert channels: `email` / `sms` / `call` booleans
- Optional `request_headers` (e.g. for auth-required health endpoints)

### Decisions needed

- [ ] **D6.1 — Monitor URL list.** Suggested:
  - `https://app.handibowls.co.za/` — production landing (post-13-7 DNS pointing). Pings 200 OK. Catches origin downtime.
  - `https://app.handibowls.co.za/api/health` — health endpoint (only if D7.1 = ship one). Returns 200 + `{ ok: true, version, db_ok }` shape; catches degraded backend even when landing renders.
  - **NOT** auth-gated routes (would just hit the redirect → unhelpful 200 OK).
  
  **Recommendation: monitor `/` only for v1.** Add `/api/health` only if D7.1 picks shipping the endpoint.
- [ ] **D6.2 — Check frequency.** Free tier minimum is 3min. Paid (Team plan, $24/mo) drops to 30s. **Recommendation: 3min on free tier.** Latency-of-detection trade-off is acceptable for v1; upgrade if real outage needs faster detection.

---

## Item 7 — Health check endpoint

### Current state

**No `/api/health`, no `/api/status`, no `/api/ping`.** App's only API routes are `/api/cron/anonymise-pending` (POPIA Vercel-Cron) and `/api/me/export` (POPIA data export). Both are auth-gated.

### Decisions needed

- [ ] **D7.1 — Ship a health endpoint?** Pros: deeper than landing-page ping (can include DB connectivity check, version stamp, last-deploy timestamp); useful for Better Stack + future automated tooling. Cons: 1 new file (~30 LOC), adds a public unauthenticated endpoint to the surface area, Better Stack's free tier monitors landing fine without it. **Recommendation: ship one.** Cheap to add, future-proofs monitoring depth, lets the Better Stack monitor differentiate "landing renders but DB is down" from "all good". Cost: 1 file under `app/api/health/route.ts`, `~30 LOC`, returns `{ ok, version, db_ok, ts }`. No auth gate (it's a health endpoint), no PII, no rate-limit needed.
- [ ] **D7.2 — Health endpoint payload shape.** If D7.1 = ship one:
  ```json
  { "ok": true, "version": "<git-sha-or-package-version>", "db_ok": true, "ts": "2026-05-03T..." }
  ```
  `db_ok` would be a `select 1` against the Supabase RLS-bound client (cheap query). Recommendation: ship that shape. No further decisions.

---

## Item 8 — Better Stack alert routing

### Decisions needed

- [ ] **D8.1 — Alert channels.** Better Stack supports email + SMS + phone call + Slack + PagerDuty + custom webhook. **Recommendation: email-only for v1.** SMS/call cost money on the paid tier; email lands in your existing inbox; v1 incident volume should be near-zero. Slack integration is worth adding post-launch if a team channel is created. Phone calls reserved for the post-launch on-call rotation if/when a real ops team forms.
- [ ] **D8.2 — Recovery period + grace.** Better Stack default: alert on first failed check; resolve on first successful check after failure. Some tunings reduce false-positive flapping. **Recommendation: defaults.** Free-tier fluttering is uncommon at 3min cadence; tighten if real flapping emerges.

---

## Item 9 — Better Stack public status page

### Mechanism

Better Stack offers public status pages at `<subdomain>.betteruptime.com` (or custom domain). Configured via dashboard or `POST /api/v2/status-pages` (subdomain + company name + timezone). Auto-shows the monitor states.

### Decisions needed

- [ ] **D9.1 — Ship a status page now or defer?** Pros: signals operational maturity to enterprise/club-admin prospects; gives users a place to check during incidents. Cons: 0 incidents to display in v1 launch (page reads as "everything is fine, always" for the first month, which is fine but not informative); requires another DNS subdomain decision (`status.handibowls.co.za`?) which doesn't fit Vercel; needs Better Stack subscription for custom domain (free tier uses `<sub>.betteruptime.com`). **Recommendation: defer to post-launch.** Spin up only when the first real incident happens (or pre-emptively at month 2 if real customer demand emerges). For v1, the Better Stack dashboard alone is sufficient.

---

## Item 10 — CSP enforcement mode

### Current state

`next.config.ts:78` ships `Content-Security-Policy-Report-Only` (does NOT block resources, only reports violations). Per the inline comment at lines 13-16: "Switch to enforcing CSP (drop the `-Report-Only` suffix) at 13-5 / 13-7 once the report-only stream is clean."

### Decisions needed

- [ ] **D10.1 — Flip to enforcing in 13-5 or stay Report-Only until 13-7?** Per the locked decision at 13-2a, the flip happens after Sentry observation period. 13-5 wires Sentry's report-uri so violations land in Sentry; the observation period needs at least one full QA cycle (login + score a match + manage a tournament + activate a rubric + render a PDF preview) per the existing DRIFT entry's acceptance criteria. **Recommendation: stay Report-Only at 13-5; flip to enforcing at 13-7 launch infra batch** after Sentry stream is clean for a full QA cycle. The 13-2a comment already prescribes this; treating it as a decision is mostly bookkeeping.

---

## Item 11 — `audit-log-error-telemetry` DRIFT entry resolution

### Current state

DRIFT entry `audit-log-error-telemetry` was re-tagged from Phase 12 to 13-5 at 13-prep. The original entry (Phase 12-2) tracks error-paths in admin actions that write to `audit_log` for compliance — when an admin action errors out *after* the audit_log write, the audit_log row exists but the action didn't complete; the inverse case (action succeeded, audit_log write failed) is even worse. The existing implementation handles atomic-transaction cases via SECURITY DEFINER RPCs, but app-layer paths (like `requestAccountDeletion`'s pre-RPC validation errors) still log to `console.error` only.

### Decisions needed

- [ ] **D11.1 — Forward audit-log-context errors to Sentry with extra context.** When an admin action involving audit_log fails, the Sentry event should include the would-be `audit_log` row shape (table_name, row_id, action, actor_id, reason) as event.extra. Sentry tags + breadcrumbs make compliance triage faster. Implementation: add a `logAuditError` helper in `lib/observability/` that wraps `Sentry.captureException` with the audit context. **Recommendation: implement at Batch A** (or fold into Batch B with Sentry CSP). Closes the DRIFT entry. Scope: 1 helper file (~20 LOC) + ~5-10 call-site updates in `_actions.ts` files. Single commit.

---

## Recommended batch shape

Five execution batches + close. Batch A is the heavy install + base config; subsequent batches are increments. Each single atomic commit unless flagged.

- **Batch A — Sentry SDK install + browser/server/edge config + PII scrubbing.** `npm install @sentry/nextjs`. Create `instrumentation.ts` + `instrumentation-client.ts` + `sentry.server.config.ts` + `sentry.edge.config.ts`. Configure per locked decisions D1.* + D2.* + D5.*. Add `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` env vars to Vercel (operator-side prerequisite). Wrap `next.config.ts` with `withSentryConfig` (no source-map upload yet — defer to Batch B). 1 commit. ~150-250 LOC across 4 new files + next.config.ts wrap. Test: `npm run build` clean, `Sentry.captureException(new Error('test'))` from a Server Action lands in Sentry dashboard.

- **Batch B — Sentry source maps + CSP report-uri extension + audit-log helper.** Configure `withSentryConfig` to upload source maps via `SENTRY_AUTH_TOKEN`. Extend `next.config.ts` CSP `connect-src` to include Sentry ingest host; add `report-uri` + `report-to` directives (D4.* locked). Implement `lib/observability/captureWithAuditContext.ts` helper (~20 LOC). Update existing `console.error` call-sites in `_actions.ts` files that touch `audit_log` to use the helper instead. Closes DRIFT `csp-authenticated-surface-violation-capture` + `audit-log-error-telemetry`. 1 commit. ~50-100 LOC across helper + next.config.ts diff + ~5-10 call-site updates.

- **Batch C — Health check endpoint.** Ship `app/api/health/route.ts` per D7.1 + D7.2. Returns `{ ok, version, db_ok, ts }`. Integration test: `curl /api/health` returns 200 + matching JSON shape; if Supabase RLS client throws, returns 503 + `db_ok: false`. 1 commit. ~30 LOC + 1 integration test (~30 LOC).

- **Batch D — Better Stack uptime monitor wiring.** Operator-side via Better Stack dashboard (or API call) — no app-side code. Per D6.* + D8.*. Configure: monitor for `https://app.handibowls.co.za/` + (if Batch C shipped) `/api/health`; check_frequency 180s; email alerts only. Document the configuration in `docs/audit/phase-13/13-5-better-stack-config.md` for the audit trail. **No commit if zero code changes; otherwise small commit covering the documentation file.**

- **Batch E — (optional) PII scrubbing tightening + ignore-list refinement.** Folds into Batch A's `beforeSend` filter; ship at A unless real noise emerges in the dashboard during the launch month. **Skip in 13-5 unless real evidence.**

- **13-5 close** — PHASE_LOG entry + DRIFT bookkeeping (close `csp-authenticated-surface-violation-capture` + `audit-log-error-telemetry` partial-or-full; track flip-CSP-to-enforcing decision for 13-7) + README state-line update. 1 commit.

**Estimated total LOC delta:** 250-450 across all batches. **Estimated commit count:** 5-6 (Batch D may be commit-less if pure dashboard config).

---

## Acceptance criteria for 13-5 close

- `@sentry/nextjs` installed; instrumentation files present at app root.
- `Sentry.captureException(new Error('test'))` from a Server Action + a client component both land in the Sentry dashboard within 60s.
- Source maps upload during Vercel build; production stack traces in Sentry are readable (function names, line numbers, original file paths).
- CSP `report-uri` directive emits to Sentry; manually-induced CSP violation lands in Sentry's CSP dashboard.
- Better Stack uptime monitor configured for production landing URL; check_frequency 180s; email alerting active.
- Health endpoint resolves at `/api/health` returning expected JSON shape.
- `audit-log-error-telemetry` DRIFT entry closed: audit_log-context errors include the row shape as event.extra in Sentry.
- `csp-authenticated-surface-violation-capture` DRIFT entry closed.
- All existing test gates green (1393 unit + 166 integration + tsc + lint at 17-warning baseline + next build clean).
- 13-5 close-verify scan against fresh Vercel preview: 0 axe critical / 0 axe serious across the full anchor set.
- No PII in any captured Sentry event (sample-check: trigger an error from a Server Action, inspect the Sentry event, confirm `request.data` + `user.email` + `user.ip` absent).

---

## Operator-side actions banked

- **Sentry org / project setup** — create the project in Sentry dashboard; capture DSN (browser-safe) + auth-token (build-time secret); set `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` + `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` env vars in Vercel (production + preview). Pre-Batch-A blocker.
- **Better Stack monitor + alert routing** — create monitor for `https://app.handibowls.co.za/` (and `/api/health` if Batch C ships) via dashboard. Configure email destination(s). Optional: capture API token for future programmatic management. Pre-Batch-D blocker.
- **DNS pointing prerequisite** — Better Stack will ping `app.handibowls.co.za`; that domain doesn't resolve until 13-7 DNS work lands. Until then, Better Stack must monitor the Vercel preview URL or production placeholder. **Decision deferred to 13-7;** for 13-5, configure the Better Stack monitor to point at the production-domain string and accept that it'll alert as DOWN until DNS lands. Operator-side awareness.
- **Sentry quota awareness** — D1.2 + D2.1 lock 1.0 sample rate for the launch month. Watch Sentry's quota dashboard at week 1 + week 2; if quota usage trends toward limits, taper to 0.1 (1 line change in two config files). Operator-side bookkeeping.
- **CSP enforcement flip at 13-7** — D10.1 banks the Report-Only → enforcing flip for 13-7 launch infra batch. Trigger condition: Sentry CSP feed clean for one full QA cycle (login + score a match + manage a tournament + activate a rubric + render a PDF preview). Track in 13-7 launch checklist.
- **Status page deferred** — D9.1 defers status page shipping to post-launch. Add to post-launch backlog if customer demand emerges.

---

## Unexpected findings during scoping

1. **CSP lives in `next.config.ts`, not `middleware.ts`.** The brief assumed middleware; actual implementation is in `next.config.ts:55-83` via the async `headers()` function. `middleware.ts` doesn't exist in the repo; auth + role gating live in route-group layouts via `requireRole()`. **Implication for Batch B:** the CSP `report-uri` extension lands in `next.config.ts`, not a middleware update.
2. **Sentry's canonical client init file renamed to `instrumentation-client.ts`** in newer SDK versions (replaces the older `sentry.client.config.ts` name). Documentation we surveyed shows both names but the current canonical pattern is `instrumentation-client.ts` at app root.
3. **`@sentry/nextjs` is fully greenfield.** Not installed, no config files, no envs. Batch A is a clean install — no migration concerns.
4. **`/api/health` does not exist.** D7.1 decides whether to ship one; if yes, Batch C is a clean ~30-LOC addition.
5. **`sendDefaultPii: true` is the SDK DEFAULT.** POPIA-incompatible; D5.1 must explicitly flip OFF in both browser + server config. The wizard's auto-generated config uses the default, which is why D1.1's recommendation lands on hand-rolled.
6. **`audit-log-error-telemetry` DRIFT entry has a clean execution path.** The audit_log table structure (table_name + row_id + action + actor + reason) is small and Sentry-event-friendly; the helper wrapper is ~20 LOC. No deeper-than-expected scope discovered.
7. **No middleware.ts, no edge-runtime routes today.** `sentry.edge.config.ts` is harmless to include but not load-bearing in v1. D2.3 confirms shipping it for completeness.
8. **Vercel's Edge Functions are deprecated** per the session-start knowledge update; future Sentry edge instrumentation may diminish in relevance further. Ship it for now; revisit if/when the codebase actively uses an edge route handler.

No defamatory or legally-risky claims surfaced. No third-category fictions. No design conflicts.

---

## Decision count summary

| Item | Decisions to lock |
|---|---:|
| Item 1 — Sentry browser SDK | 5 (D1.1 - D1.5) |
| Item 2 — Sentry server / edge SDK | 3 (D2.1 - D2.3) |
| Item 3 — Sentry source maps | 1 (D3.1) |
| Item 4 — Sentry CSP report-uri | 2 (D4.1 - D4.2) |
| Item 5 — PII scrubbing | 3 (D5.1 - D5.3) |
| Item 6 — Better Stack uptime monitors | 2 (D6.1 - D6.2) |
| Item 7 — Health check endpoint | 2 (D7.1 - D7.2) |
| Item 8 — Better Stack alert routing | 2 (D8.1 - D8.2) |
| Item 9 — Better Stack status page | 1 (D9.1) |
| Item 10 — CSP enforcement mode | 1 (D10.1) |
| Item 11 — audit-log-error-telemetry | 1 (D11.1) |
| **Total** | **23** |

23 decisions surfaced for user triage before Batch A opens.
