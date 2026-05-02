# Phase 13 / 13-1 — A11y Baseline

Captured: 2026-05-02T11:51:29.306Z
Preview: https://handibowls-pofdn4l7i-andrews-projects-a0c14c4f.vercel.app

## Per-surface scores

| Surface | Lighthouse a11y | Lighthouse perf | axe critical | axe serious | axe moderate | axe minor |
|---|---:|---:|---:|---:|---:|---:|
| / (landing) | 98 | 52 | 0 | 0 | 1 | 0 |
| /login (auth) | 100 | 79 | 0 | 0 | 0 | 0 |
| /play (player home) | 94 | 67 | 0 | 1 | 1 | 0 |
| /tournaments/[id] (player detail) | 95 | 75 | 0 | 1 | 0 | 0 |
| /t20 (player T20 hub) | 94 | 65 | 0 | 1 | 1 | 0 |
| /me (player profile) | 90 | 65 | 0 | 2 | 1 | 0 |
| /manage (club admin overview) | 96 | 50 | 0 | 1 | 1 | 0 |
| /manage/tournaments/[id] (L67=85 surface) | 88 | 40 | 2 | 0 | 2 | 1 |
| /manage/members (Tier E anchor) | 100 | 45 | 0 | 1 | 1 | 0 |
| /platform/clubs (super admin) | 100 | 39 | 0 | 0 | 1 | 0 |

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
| `list` | serious | 2 | <ul> and <ol> must only directly contain <li>, <script> or <template> elements |

### /manage (club admin overview)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `color-contrast` | serious | 2 | Elements must meet minimum color contrast ratio thresholds |
| `landmark-complementary-is-top-level` | moderate | 1 | Aside should not be contained in another landmark |

### /manage/tournaments/[id] (L67=85 surface)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `aria-required-children` | critical | 1 | Certain ARIA roles must contain particular children |
| `aria-required-parent` | critical | 2 | Certain ARIA roles must be contained by particular parents |
| `empty-table-header` | minor | 1 | Table header text should not be empty |
| `heading-order` | moderate | 1 | Heading levels should only increase by one |
| `landmark-complementary-is-top-level` | moderate | 1 | Aside should not be contained in another landmark |

### /manage/members (Tier E anchor)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `landmark-complementary-is-top-level` | moderate | 1 | Aside should not be contained in another landmark |
| `scrollable-region-focusable` | serious | 1 | Scrollable region must have keyboard access |

### /platform/clubs (super admin)
| Rule | Impact | Nodes | Description |
|---|---|---:|---|
| `landmark-complementary-is-top-level` | moderate | 1 | Aside should not be contained in another landmark |

## Stage 2 close-gate targets

- Lighthouse Accessibility ≥ 95 on all 10 surfaces.
- axe critical violations = 0 on all 10 surfaces.