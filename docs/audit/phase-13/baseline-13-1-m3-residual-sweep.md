# Phase 13 / 13-1 — A11y Baseline

Captured: 2026-05-02T17:22:07.398Z
Preview: https://handibowls-ee9iwpvd5-andrews-projects-a0c14c4f.vercel.app

## Per-surface scores

| Surface | Lighthouse a11y | Lighthouse perf | axe critical | axe serious | axe moderate | axe minor |
|---|---:|---:|---:|---:|---:|---:|
| / (landing) | 100 | 69 | 0 | 0 | 0 | 0 |
| /login (auth) | 100 | 78 | 0 | 0 | 0 | 0 |
| /play (player home) | 100 | 64 | 0 | 0 | 0 | 0 |
| /tournaments/[id] (player detail) | 100 | 80 | 0 | 0 | 0 | 0 |
| /t20 (player T20 hub) | 100 | 66 | 0 | 0 | 0 | 0 |
| /me (player profile) | 96 | 70 | 0 | 1 | 0 | 0 |
| /manage (club admin overview) | 100 | 43 | 0 | 0 | 0 | 0 |
| /manage/tournaments/[id] (L67=85 surface) | 100 | 41 | 0 | 0 | 0 | 0 |
| /manage/members (Tier E anchor) | 100 | 33 | 0 | 0 | 0 | 0 |
| /platform/clubs (super admin) | 100 | 38 | 0 | 0 | 0 | 0 |

## axe violation breakdown (per surface)

### /me (player profile)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | 3 | Elements must meet minimum color contrast ratio thresholds |

## Stage 2 close-gate targets

- Lighthouse Accessibility ≥ 95 on all 10 surfaces.
- axe critical violations = 0 on all 10 surfaces.