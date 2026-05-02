# Phase 13 / 13-1 — A11y Baseline

Captured: 2026-05-02T10:27:58.572Z
Preview: https://handibowls-chsc1zn6z-andrews-projects-a0c14c4f.vercel.app

## Per-surface scores

| Surface | Lighthouse a11y | Lighthouse perf | axe critical | axe serious | axe moderate | axe minor |
|---|---:|---:|---:|---:|---:|---:|
| / (landing) | — | — | 0 | 1 | 1 | 0 |
| /login (auth) | — | — | 0 | 1 | 0 | 0 |
| /play (player home) | — | — | 0 | 1 | 0 | 0 |
| /tournaments/[id] (player detail) | — | — | — | — | — | — |
| /t20 (player T20 hub) | — | — | 0 | 1 | 0 | 0 |
| /me (player profile) | — | — | 0 | 1 | 0 | 0 |
| /manage (club admin overview) | — | — | 0 | 1 | 0 | 0 |
| /manage/tournaments/[id] (L67=85 surface) | — | — | — | — | — | — |
| /manage/members (Tier E anchor) | — | — | 0 | 1 | 0 | 0 |
| /platform/clubs (super admin) | — | — | 0 | 1 | 0 | 0 |

## axe violation breakdown (per surface)

### / (landing)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | [object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object],[object Object] | Elements must meet minimum color contrast ratio thresholds |
| `heading-order` | moderate | [object Object] | Heading levels should only increase by one |

### /login (auth)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | [object Object],[object Object],[object Object],[object Object],[object Object] | Elements must meet minimum color contrast ratio thresholds |

### /play (player home)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | [object Object],[object Object],[object Object],[object Object],[object Object] | Elements must meet minimum color contrast ratio thresholds |

### /t20 (player T20 hub)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | [object Object],[object Object],[object Object],[object Object],[object Object] | Elements must meet minimum color contrast ratio thresholds |

### /me (player profile)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | [object Object],[object Object],[object Object],[object Object],[object Object] | Elements must meet minimum color contrast ratio thresholds |

### /manage (club admin overview)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | [object Object],[object Object],[object Object],[object Object],[object Object] | Elements must meet minimum color contrast ratio thresholds |

### /manage/members (Tier E anchor)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | [object Object],[object Object],[object Object],[object Object],[object Object] | Elements must meet minimum color contrast ratio thresholds |

### /platform/clubs (super admin)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | [object Object],[object Object],[object Object],[object Object],[object Object] | Elements must meet minimum color contrast ratio thresholds |

## Stage 2 close-gate targets

- Lighthouse Accessibility ≥ 95 on all 10 surfaces.
- axe critical violations = 0 on all 10 surfaces.