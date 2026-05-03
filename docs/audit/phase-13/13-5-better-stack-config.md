# Phase 13 / 13-5 — Better Stack uptime monitor configuration

**Configured:** 2026-05-04
**Tier:** Free
**Service:** Better Stack Uptime

---

## Monitor 1: HandiBowls — Landing

| Field | Value |
|---|---|
| Type | HTTP/HTTPS |
| URL | https://app.handibowls.co.za/ |
| HTTP method | GET |
| Alert condition | URL becomes unavailable |
| Check frequency | 3 minutes (free tier minimum) |
| Recovery period | 3 minutes |
| Confirmation period | Immediate start |
| Request timeout | 30 seconds |
| IP version | Both IPv4 and IPv6 |
| SSL/TLS verification | On |
| SSL expiration check | Off (free tier locked) |
| Domain expiration check | Off (free tier locked) |

---

## Monitor 2: HandiBowls — Health Check

| Field | Value |
|---|---|
| Type | HTTP/HTTPS |
| URL | https://app.handibowls.co.za/api/health |
| HTTP method | GET |
| Alert condition | URL becomes unavailable |
| Check frequency | 3 minutes |
| Recovery period | 3 minutes |
| Confirmation period | Immediate start |
| Request timeout | 30 seconds |
| SSL/TLS verification | On |

---

## Escalation policy

- Notify: Primary responder (no escalation policy used in v1 — single-operator launch)
- Notification channels: E-mail only
- If primary doesn't acknowledge: Do nothing
- SMS / phone / push notification / Slack: deferred to post-launch

---

## Initial state

Both monitors will alert DOWN until Phase 13 / 13-7 (DNS pointing for app.handibowls.co.za) lands. This is expected behaviour — production domain doesn't resolve yet.

Operator-side option: pause monitors during the pre-launch window if alert noise becomes friction. Resume on 13-7 deploy.

---

## Operator-side actions banked for 13-7

- Confirm both monitors flip to UP within ~5 min of DNS propagation completing
- If Monitor 2 (health check) doesn't pick up automatically when DNS lands, manually trigger a check in Better Stack dashboard
- Verify alert email arrives in user's inbox at first DOWN→UP transition
- (Optional) Add SSL expiration check at Phase 14 — Better Stack free tier doesn't expose this; either upgrade Better Stack or set a calendar reminder for cert renewal at +60 days from cert issue date

---

## Operator-side actions banked for Phase 14 / post-launch

- Slack integration if team channel emerges
- SMS / phone alerts if 24/7 on-call rotation forms
- Status page (deferred per scoping § Item 9 / D9.1)
- Keyword matching on Monitor 2 (alert if response returns 200 but `db_ok: false` — currently locked to status-code-only on free tier)
