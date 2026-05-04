# LAUNCH_DNS_CHECKLIST

Operator-facing checklist for the post-13-7 DNS-access launch tasks. Action this when registrar access for `handibowls.co.za` lands. Sibling document `LAUNCH_DEPLOY_DRY_RUN.md` covers the pre-DNS Vercel preview deployment.

The checklist is ordered so each step's verification can complete before the next step depends on it. Don't skip ahead.

## 1. Vercel custom domain

**Goal:** the production deploy serves `https://app.handibowls.co.za`.

1. **Add the domain in Vercel.** Project → Settings → Domains → **Add Domain** → enter `app.handibowls.co.za` → click Add.

2. **Vercel returns a CNAME target.** It will look like `cname.vercel-dns.com`. Copy that exact value.

3. **At the registrar / DNS host:** add a CNAME record:
   - **Type:** CNAME
   - **Host:** `app` (or `app.handibowls.co.za` depending on the registrar's UI)
   - **Value:** the CNAME target Vercel gave you
   - **TTL:** 300 (5 minutes — keeps you nimble during DNS changes; raise to 3600 once stable)

4. **Wait for propagation.** Typically 1–10 minutes for a fresh CNAME. Verify with:

   ```bash
   dig app.handibowls.co.za CNAME +short
   # Should return cname.vercel-dns.com
   ```

5. **Vercel auto-issues the TLS certificate** (Let's Encrypt) once it sees the CNAME resolve. Watch the Vercel domain page — the status flips from "Invalid Configuration" → "Valid Configuration" → green checkmark.

6. **Verify HTTPS.** Open `https://app.handibowls.co.za` in a fresh browser. Should serve the marketing landing page (not Vercel's "missing project" page).

7. **Update Vercel env var.** Project → Settings → Environment Variables → edit `NEXT_PUBLIC_APP_URL` → set to `https://app.handibowls.co.za`. Redeploy to propagate.

## 2. Resend domain verification

**Goal:** outbound email sends from `no-reply@handibowls.co.za` (or your chosen sending subdomain) instead of the v1 testing sender `onboarding@resend.dev`.

### 2a. Choose a sending subdomain

Recommended: **`mail.handibowls.co.za`** (or `send.handibowls.co.za`). Subdomain isolation means your domain reputation isn't tied to the apex if marketing/transactional sending diverges later.

For v1 with single-sender, the apex (`handibowls.co.za`) is also acceptable. Stick to one — don't verify both.

### 2b. Add the domain at Resend

1. Resend dashboard → **Domains** → **Add Domain** → enter the chosen domain (e.g. `mail.handibowls.co.za`).

2. Resend returns three DNS records to add:
   - **MX** — for return-path / bounce handling
   - **TXT (SPF)** — for sender authentication
   - **CNAME (DKIM)** — usually two records, for email signing

   Each record's exact value is generated per-domain by Resend; copy them from the Resend dashboard.

### 2c. Add the records at the registrar

For each record Resend lists:

| Record type | Where it lives | Notes |
|---|---|---|
| MX | At the chosen subdomain (e.g. `mail.handibowls.co.za`) | Priority value matters; Resend specifies (typically 10). |
| TXT (SPF) | At the chosen subdomain. Value starts `v=spf1 include:_spf.resend.com -all` (or similar). | If the apex already has an SPF record, **don't** duplicate; combine includes if you ever send from multiple providers. |
| CNAME (DKIM) | Two records under the chosen subdomain (e.g. `resend._domainkey.mail.handibowls.co.za`). | Strict CNAME — point at Resend's hostnames exactly. |

### 2d. Verify in the Resend dashboard

1. Click **Verify** in the Resend dashboard.
2. Resend probes DNS. Verification typically takes 1–5 minutes once records have propagated.
3. Status should flip from "Pending" → "Verified".

If verification stalls beyond 30 minutes, run `dig` on each record to confirm they resolve from a public DNS, e.g.:

```bash
dig mail.handibowls.co.za MX
dig mail.handibowls.co.za TXT
dig resend._domainkey.mail.handibowls.co.za CNAME
```

Common gotcha: registrars sometimes nest the host segment incorrectly (you enter `mail` but the registrar saves it as `mail.handibowls.co.za.handibowls.co.za`). Re-check the host field if records don't resolve.

## 3. DMARC TXT record

**Goal:** publish a DMARC policy so receiving mail servers know how to handle authentication failures + where to send aggregate reports.

**Start in monitor mode (`p=none`).** Don't go straight to `quarantine` or `reject` — verify the SPF + DKIM are clean over a 1–2 week observation period first; tighten the policy only after confirming aggregate reports show no false positives.

1. **At the registrar:** add a TXT record at `_dmarc.handibowls.co.za`:

   - **Type:** TXT
   - **Host:** `_dmarc`
   - **Value:** `v=DMARC1; p=none; rua=mailto:dmarc-reports@handibowls.co.za; pct=100; aspf=r; adkim=r;`

   - `p=none` — monitor mode (don't reject failing mail; just report).
   - `rua=mailto:...` — aggregate report destination. Use a real inbox you check (or a dmarc.report-aggregator service).
   - `pct=100` — apply the policy to 100% of mail (only relevant when `p` ≠ `none`).
   - `aspf=r` and `adkim=r` — relaxed alignment (subdomain match counts).

2. **Verify:**

   ```bash
   dig _dmarc.handibowls.co.za TXT +short
   # Should return the value above
   ```

3. **Wait one or two send cycles** for receiving providers (Gmail, Outlook, etc.) to send DMARC aggregate reports to the `rua` address. Reports typically arrive within 24h after the first send.

4. **After 1–2 weeks of clean reports:** tighten the policy:
   - `p=quarantine` — failing mail goes to spam.
   - `p=reject` — failing mail bounces.

   Most operators stay on `p=none` indefinitely for the v1 launch unless you have a phishing-impersonation concern.

## 4. Better Stack monitor

**Goal:** uptime alerts to your inbox if the production deploy goes down.

Operator already has a Better Stack account (per 13-5 / Batch D documentation in `docs/audit/phase-13/13-5-better-stack-config.md`). What's banked here is the swap from "alerts are DOWN by design until DNS lands" → "alerts are LIVE on the real production URL".

1. Better Stack dashboard → **Monitors** → find or create:

   | Monitor name | URL | Cadence | Type |
   |---|---|---|---|
   | HandiBowls landing | `https://app.handibowls.co.za` | 3 min | HTTP(s) |
   | HandiBowls health | `https://app.handibowls.co.za/api/health` | 3 min | HTTP(s) — expect 200 with body containing `"ok":true` |

2. **Alert routing:** email-only for v1 (per locked decision D8.1 from 13-5 scoping). SMS / Slack / phone deferred.

3. **Confirm the first few probes succeed.** Both monitors should flip from "Down" → "Up" within 5 minutes of DNS propagation. If the health monitor stays Down, hit `/api/health` manually + check the response shape — `db_ok:false` indicates a Supabase connection issue from Vercel.

## 5. Post-DNS code change — RESEND_FROM swap

**Goal:** flip the v1 testing sender to the verified production sender.

**Scope:** single-line config swap. No code change in the repo — operator-side env var update only.

1. Vercel dashboard → Project → Settings → Environment Variables.

2. Edit **`RESEND_FROM`** in the **Production** environment:
   - **Was:** `"HandiBowls <onboarding@resend.dev>"`
   - **To:** `"HandiBowls <no-reply@mail.handibowls.co.za>"` (or whatever sender you verified at step 2 above).

3. Trigger a redeploy.

4. **Verify the swap landed.** Trigger an invite send (admin → Members → Invite Player) to a real test inbox you control:
   - The email arrives from your verified sender, not the Resend testing sender.
   - DKIM check passes (Gmail: ⋮ → Show original → "DKIM: PASS").
   - SPF check passes.

5. **Failure mode if DNS isn't actually verified yet:** the `sendEmail` call returns `{ ok: false, kind: "domain_not_verified" }` and emits a `[email:skipped]` console.warn line in Vercel logs. The invite row still persists (graceful failure). If you see this, re-check Resend dashboard verification status.

## 6. Sentry verification (post-DNS)

If you skipped Sentry verification during the dry-run (`LAUNCH_DEPLOY_DRY_RUN.md` §4), do it now against the production URL.

The pattern is identical: temporarily edit `app/page.tsx` to throw on `?sentryTest=throw`, deploy, hit the URL, confirm the error reaches Sentry, revert. See `LAUNCH_DEPLOY_DRY_RUN.md` §4 for the exact steps.

Watch the Sentry dashboard:
- Stack trace symbolicates against real source paths (proves source-map upload works on Vercel CI).
- Release matches the deployment SHA.
- No PII attached (request body is `undefined`, user is anonymous).

## 7. Sanity smoke-test sequence (final)

After all the above lands, do a final 10-minute sweep on `https://app.handibowls.co.za`:

| Route | Expected |
|---|---|
| `/` | Marketing landing renders. |
| `/login` + `/signup` | Forms render. |
| `/privacy`, `/terms`, `/help` | Static pages render. |
| `/api/health` | 200 + `db_ok:true` JSON. |
| Sign in as a seeded admin → `/manage/overview` | Hero + getting-started checklist + bookings calendar. |
| Send a test invite | Email arrives at the recipient inbox from the verified sender. DKIM passes. |
| Watch DevTools console across all routes | No CSP violations. No uncaught errors. |
| Watch Sentry dashboard for ~30 minutes post-launch | No unexpected errors. |
| Watch Better Stack monitors for ~24h | Both monitors stay Up; no down-time notifications. |
| Watch the next 04:00 UTC cron run | `/api/cron/anonymise-pending` logs `{processed,succeeded,failed}` shape with no 500. |

Once all green: launch is complete.

## 8. Things that might go wrong + first checks

| Symptom | First check |
|---|---|
| Domain not resolving 1h+ after DNS update | `dig` the CNAME to confirm propagation. Some registrars take longer than 10m. |
| Resend verification stuck on Pending | `dig` each TXT/CNAME/MX. Most often a host-field nesting bug at the registrar. |
| `/api/health` returns 503 | Supabase service-role key not set OR Supabase project is paused. |
| CSP violations in console post-deploy | Revert per `LAUNCH_DEPLOY_DRY_RUN.md` §6 — single-line `sed` revert of the header key. Re-open DRIFT `csp-enforcement-flip-13-7`. |
| Email goes to spam (DMARC quarantine) | Tightened DMARC too early. Move back to `p=none` and observe aggregate reports for another week. |
| Invite emails fail with `domain_not_verified` after DNS update | Resend verification didn't actually finish (status check in dashboard). OR `RESEND_FROM` env var still points at the old testing sender (force a redeploy after editing). |
| Cron run logs `CRON_SECRET not configured` 500 | `CRON_SECRET` env var not set in Production. Set + redeploy. |
| Sentry DSN unreachable from browser | CSP `connect-src` missing the Sentry ingest host. Verify `next.config.ts:94`. |
