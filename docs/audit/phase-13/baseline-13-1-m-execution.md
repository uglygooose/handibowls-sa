# Phase 13 / 13-1 — A11y Baseline

Captured: 2026-05-03T13:59:27.255Z
Preview: https://handibowls-gsjs7gody-andrews-projects-a0c14c4f.vercel.app

## Per-surface scores

| Surface | Lighthouse a11y | Lighthouse perf | axe critical | axe serious | axe moderate | axe minor |
|---|---:|---:|---:|---:|---:|---:|
| / (landing) | 96 | 46 | 0 | 1 | 0 | 0 |
| /login (auth) | 100 | 74 | 0 | 0 | 0 | 0 |
| /play (player home) | 100 | 55 | 0 | 0 | 0 | 0 |
| /tournaments/[id] (player detail) | 100 | 54 | 0 | 0 | 0 | 0 |
| /t20 (player T20 hub) | 96 | 53 | 0 | 1 | 0 | 0 |
| /me (player profile) | 96 | 68 | 0 | 1 | 0 | 0 |
| /manage (club admin overview) | 100 | 39 | 0 | 0 | 0 | 0 |
| /manage/tournaments/[id] (L67=85 surface) | 100 | 42 | 0 | 0 | 0 | 0 |
| /manage/members (Tier E anchor) | 100 | 50 | 0 | 0 | 0 | 0 |
| /platform/clubs (super admin) | 100 | 46 | 0 | 0 | 0 | 0 |

## axe violation breakdown (per surface)

### / (landing)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | 1 | Elements must meet minimum color contrast ratio thresholds |

### /t20 (player T20 hub)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | 3 | Elements must meet minimum color contrast ratio thresholds |

### /me (player profile)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | 3 | Elements must meet minimum color contrast ratio thresholds |

## Stage 2 close-gate targets

- Lighthouse Accessibility ≥ 95 on all 10 surfaces.
- axe critical violations = 0 on all 10 surfaces.