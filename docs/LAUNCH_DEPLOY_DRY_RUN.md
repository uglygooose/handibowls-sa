# LAUNCH_DEPLOY_DRY_RUN

Operator-facing checklist for the Phase 13 / 13-7 Vercel preview deployment dry-run. Walks through env-var setup, smoke-tests, Sentry verification, and rollback. Written at the close of 13-7; sibling document `LAUNCH_DNS_CHECKLIST.md` covers the post-DNS-access steps that this dry-run intentionally defers.

## 1. Context

Phase 13 / 13-7 ships v1's launch infrastructure on the Vercel preview URL. No custom domain. No Resend domain verification. No DMARC/DKIM/SPF. The app runs end-to-end against the preview URL with the Resend testing sender (`onboarding@resend.dev`) and graceful-failure email semantics — invite rows persist, email delivery is best-effort, and the operator can grep Vercel logs for `[email:skipped]` lines.

**Branch tip at 13-7 close:** the latest commit on `rebuild/phase-13-launch-prep` after this batch lands. Open the branch in Vercel; the preview URL is what you smoke-test below.

## 2. Vercel project env vars

Set every variable in **both** the **Production** and **Preview** environments in the Vercel project (Settings → Environment Variables). The deploy will work without all of them but the failure modes vary — Supabase missing → 500 on every authenticated route; CRON_SECRET missing → 500 on the daily cron; Sentry DSN missing → no telemetry but the app still serves.

Each value below names its **source** so you don't have to dig.

| Variable | Source | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL | Public — exposed to the browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API → `anon public` | Public — exposed to the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → `service_role secret` | **Server-only.** Bypasses RLS. Never put in a `NEXT_PUBLIC_*` var. |
| `NEXT_PUBLIC_APP_URL` | Set to the Vercel preview URL for the dry-run (e.g. `https://handibowls-rebuild-phase-13-launch-prep-uglygooose.vercel.app`). | Used in invite-accept URLs + unsubscribe links. Update post-DNS to `https://app.handibowls.co.za`. |
| `NEXT_PUBLIC_APP_NAME` | `"HandiBowls"` | Default; only override if rebranding. |
| `RESEND_API_KEY` | Resend dashboard → API Keys → create key | **Server-only.** Treat as secret. |
| `RESEND_FROM` | `"HandiBowls <onboarding@resend.dev>"` | v1 default, works without DNS. Swap post-DNS per `LAUNCH_DNS_CHECKLIST.md`. |
| `EMAIL_UNSUBSCRIBE_SIGNING_SECRET` | Generate locally: `openssl rand -hex 32` | **Server-only.** Rotating invalidates in-flight unsubscribe links. |
| `RESEND_WEBHOOK_SECRET` | Resend dashboard → Webhooks → (target endpoint) → Signing secret | Empty acceptable for v1 (no webhook target). |
| `VERCEL_PROTECTION_BYPASS` | Vercel dashboard → Settings → Deployment Protection → Protection Bypass for Automation → generate token | Used by Lighthouse / axe scripts to access SSO-protected previews. Reused across phase work. |
| `CRON_SECRET` | Generate locally: `openssl rand -hex 32` | **Server-only.** Required by `/api/cron/anonymise-pending`. Vercel auto-attaches `Authorization: Bearer ${CRON_SECRET}` on cron-triggered hits. **Set this BEFORE the first scheduled cron run** (04:00 UTC daily). |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry dashboard → Settings → Projects → handibowls → Client Keys (DSN) | Public DSN — exposed to the browser. |
| `SENTRY_DSN` | Same DSN value as above. | Server + edge SDK. |
| `SENTRY_AUTH_TOKEN` | Sentry dashboard → Settings → Account → Auth Tokens → create with `project:releases` scope | Source-map upload during Vercel build. |
| `SENTRY_ORG` | Sentry org slug from the project URL. | E.g. `your-org`. |
| `SENTRY_PROJECT` | Sentry project slug. | E.g. `handibowls`. |

After saving every variable, **trigger a redeploy** (Deployments → ⋮ on the latest preview → Redeploy → check "Use existing build cache"). Without a redeploy the env vars don't propagate.

## 3. Smoke-test checklist (post-deploy, ~15 minutes)

Hit each route in a fresh browser tab. Watch the DevTools console for **CSP violation** errors (these surface as `Refused to ... because it violates the following Content Security Policy directive: ...`). Any CSP violation = revert the CSP enforcement flip per the rollback procedure below.

### Public surfaces (unauthenticated)

| Route | Expected | What can go wrong |
|---|---|---|
| `/` | Marketing landing renders. Hero + tournament showcase + Twenty 20 mock card + features grid + CTAs visible. No console errors. | Inline-script CSP violation → Next.js hydration may emit one — capture + revert if seen. |
| `/login` | Auth form renders (email + password + signin button). | OAuth flows blocked by CSP if a provider is configured (none in v1). |
| `/signup` | Auth form. Terms + privacy links work and reach `/terms` + `/privacy`. | Form action submit goes through; redirect to `/me/setup` post-signup. |
| `/privacy` | Full POPIA policy renders (13 sections, version 1.0). | 404 = build issue. |
| `/terms` | Full terms render (8 sections, version 1.0). | 404 = build issue. |
| `/help` | Index lists 4 articles in canonical order. | Footer "Help" link in Clubs column also reaches `/help`. |
| `/help/creating-a-tournament` | Article renders with kicker + h1 + body + back-link to `/help`. | Repeat for the other 3 slugs as a spot-check. |

### Health endpoint

| Route | Expected |
|---|---|
| `/api/health` | JSON 200: `{"ok":true,"version":"<7-char-sha>","db_ok":true,"ts":"<iso>"}`. If `db_ok:false` arrives, the Supabase connection from Vercel is broken — confirm `SUPABASE_SERVICE_ROLE_KEY` env var is set in the Vercel project. |

### Auth-gated surfaces (must be unauthenticated for the redirect-to-login check)

| Route | Expected |
|---|---|
| `/me` | 302 redirect to `/login`. |
| `/play` | 302 redirect to `/login`. |
| `/manage/overview` | 302 redirect to `/login`. |
| `/platform/clubs` | 302 redirect to `/login`. |

### Authenticated player surfaces (sign in as a seeded player first)

Local seed data should contain at least one player + one tournament + one match. If your dev database is freshly cloned to the production DB, seed via your standard fixture path before the dry-run.

| Route | Expected |
|---|---|
| `/play` | Player home renders with hero + quick action tiles. No console errors. |
| `/me` | Profile + bookings + settings rows render. |
| `/me/settings/data-and-privacy` | Download + delete affordances render. Privacy policy link reaches `/privacy`. |
| `/book` | Date strip + slot list render. |
| `/t20` | Assessment hub renders with grade ladder + past assessments list. |

### Authenticated admin surface (sign in as a seeded `club_admin`)

| Route | Expected |
|---|---|
| `/manage/overview` | Hero + getting-started checklist (5 items, state varies by club fixtures) + bookings calendar + audit log. |
| `/manage/members` | Member list. |
| `/manage/tournaments` | Tournament list. |

### CSP enforcement smoke (any authenticated session)

Open DevTools → Console BEFORE navigating. Hit `/play` + `/me` + `/manage/overview`. Look for any line starting with **"Refused to..."** — these are blocked CSP directives. Common ones to watch for:

- `Refused to load the script ...` → external script blocked. Add the host to `script-src` in `next.config.ts:95`.
- `Refused to apply inline style ...` → unexpected; `'unsafe-inline'` is allowed for `style-src`.
- `Refused to connect to ...` → external API blocked. Add to `connect-src` in `next.config.ts:94`.

**If any CSP violation surfaces on auth routes,** revert the CSP flip per §6 below — this is the documented residual risk from the 13-7 kickoff lock.

## 4. Sentry verification

Sentry browser/server/edge SDK is wired and source-map upload runs in Vercel CI. To confirm the wire end-to-end, deliberately throw a controlled error in production and verify it lands in the Sentry dashboard.

**One-time verify-and-revert pattern** (no code surface added in steady state):

1. Open `app/page.tsx`. Add at the very top of the default-export function body:

   ```ts
   if (process.env.SENTRY_TEST === "throw") {
     throw new Error("Sentry verification: 13-7 prod deploy");
   }
   ```

2. Set `SENTRY_TEST=throw` in **Production** Vercel env vars (Settings → Environment Variables).

3. Trigger a redeploy.

4. Hit the production URL `/`. The page errors out (Next.js error boundary).

5. Within ~30 seconds the error appears in **Sentry → Issues → Unresolved**. Confirm:
   - The stack trace shows `app/page.tsx:<line>` (symbolicated — source-map upload working).
   - No PII attached (`request.data` is `undefined`; `user.id` is null since unauthenticated).
   - The release matches the deployment SHA.

6. **Revert:** unset `SENTRY_TEST` in Vercel env vars. Remove the throw block from `app/page.tsx`. Commit + push the revert. Vercel auto-deploys.

If the error doesn't reach Sentry within 5 minutes:
- Check the browser DevTools Network tab — look for a request to `https://o*.ingest.sentry.io/...`. If it's blocked, the CSP `connect-src` directive is missing the Sentry host (verify in `next.config.ts:94`).
- Check Sentry dashboard → Settings → Projects → handibowls → Client Keys — confirm the DSN matches the env var.
- Check Vercel build logs for "Sentry CLI: source map upload skipped" — if seen, `SENTRY_AUTH_TOKEN` isn't set or lacks the `project:releases` scope.

## 5. Cron verification (waits 24h)

The Vercel Cron schedule is `0 4 * * *` — daily at 04:00 UTC. After the first scheduled run:

1. Vercel dashboard → Functions → `/api/cron/anonymise-pending` → Logs.
2. Confirm the run logs `{processed:0, succeeded:0, failed:0}` (or non-zero with no errors if any soft-deleted profile is in the queue).
3. **No 500 status. No `CRON_SECRET not configured` errors.** If either appears, `CRON_SECRET` isn't set on the Production environment.

If you want to test the cron immediately without waiting 24h:

```bash
curl -X GET 'https://<your-preview-url>/api/cron/anonymise-pending' \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

Expected: 200 + JSON result body. Any other response means env vars or auth are wrong.

## 6. Rollback procedure

Two rollback paths depending on what's broken.

### Bad deploy (build is fine but runtime behaviour is broken)

Vercel dashboard → Deployments → find the last known-good deployment → ⋮ → **Promote to Production**. Takes ~30 seconds to swap. The bad deploy's URL stays accessible for triage.

### Bad commit (need to revert the underlying code)

```bash
git revert <bad-sha>
git push origin rebuild/phase-13-launch-prep
```

Vercel auto-deploys the revert commit. If the bad commit is the CSP enforcement flip and you need a fast-path revert without a full git revert dance:

```bash
# Single-line revert: re-add the -Report-Only suffix
sed -i 's/key: "Content-Security-Policy"/key: "Content-Security-Policy-Report-Only"/' next.config.ts
git add next.config.ts
git commit -m "revert(security): CSP back to Report-Only — auth-surface violation surfaced"
git push
```

Then re-open DRIFT entry `csp-enforcement-flip-13-7` and document what fired.

### Bad env var (config not code)

Vercel dashboard → Settings → Environment Variables → edit the value → trigger redeploy. No git changes.

## 7. What this dry-run does NOT cover (banked for `LAUNCH_DNS_CHECKLIST.md`)

- Custom domain `app.handibowls.co.za` (operator action: registrar DNS + Vercel custom-domain add).
- Resend domain verification (operator action: `handibowls.co.za` MX/DKIM/SPF DNS records).
- DMARC TXT record.
- Better Stack monitor on the production URL.
- The post-DNS `RESEND_FROM` swap.

When DNS access lands, follow `LAUNCH_DNS_CHECKLIST.md`.
