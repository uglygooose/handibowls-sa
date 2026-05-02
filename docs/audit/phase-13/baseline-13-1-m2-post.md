# Phase 13 / 13-1 — A11y Baseline

Captured: 2026-05-02T13:12:38.862Z
Preview: https://handibowls-ki59ji1t1-andrews-projects-a0c14c4f.vercel.app

## Per-surface scores

| Surface | Lighthouse a11y | Lighthouse perf | axe critical | axe serious | axe moderate | axe minor |
|---|---:|---:|---:|---:|---:|---:|
| / (landing) | 98 | 47 | 0 | 0 | 1 | 0 |
| /login (auth) | 100 | 66 | 0 | 0 | 0 | 0 |
| /play (player home) | 94 | 63 | 0 | 1 | 1 | 0 |
| /tournaments/[id] (player detail) | 96 | 68 | 0 | 1 | 0 | 0 |
| /t20 (player T20 hub) | 94 | 69 | 0 | 1 | 1 | 0 |
| /me (player profile) | 94 | 69 | 0 | 1 | 1 | 0 |
| /manage (club admin overview) | 96 | 40 | 0 | 1 | 0 | 0 |
| /manage/tournaments/[id] (L67=85 surface) | 100 | 38 | 0 | 0 | 0 | 1 |
| /manage/members (Tier E anchor) | 100 | 35 | 0 | 1 | 0 | 0 |
| /platform/clubs (super admin) | 100 | 41 | 0 | 0 | 0 | 0 |

## axe violation breakdown (per surface)

### / (landing)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `heading-order` | moderate | 1 | Heading levels should only increase by one |

### /play (player home)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | 7 | Elements must meet minimum color contrast ratio thresholds |
| `heading-order` | moderate | 1 | Heading levels should only increase by one |

### /tournaments/[id] (player detail)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | 3 | Elements must meet minimum color contrast ratio thresholds |

### /t20 (player T20 hub)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | 5 | Elements must meet minimum color contrast ratio thresholds |
| `heading-order` | moderate | 1 | Heading levels should only increase by one |

### /me (player profile)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | 9 | Elements must meet minimum color contrast ratio thresholds |
| `heading-order` | moderate | 1 | Heading levels should only increase by one |

### /manage (club admin overview)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | 2 | Elements must meet minimum color contrast ratio thresholds |

### /manage/tournaments/[id] (L67=85 surface)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `empty-table-header` | minor | 1 | Table header text should not be empty |

### /manage/members (Tier E anchor)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `scrollable-region-focusable` | serious | 1 | Scrollable region must have keyboard access |

## Stage 2 close-gate targets

- Lighthouse Accessibility ≥ 95 on all 10 surfaces.
- axe critical violations = 0 on all 10 surfaces.