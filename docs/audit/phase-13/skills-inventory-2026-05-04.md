# Skills inventory audit — 2026-05-04

**Phase:** 13 / 13-3 (pre-K-prep pause).
**Branch tip at audit:** `319b9b6` (`rebuild/phase-13-launch-prep`).
**Scope:** read-only canonical inventory of every skill installed across project-local + user-global surfaces, cross-referenced against the three known reference lists (userMemories 15-base, Phase-13-lens 5, Vercel plugin 25), with cross-skill dependency check.

---

## Skill sources

### Project-local

| Path candidate | State |
|---|---|
| `.claude/skills/` (repo root) | **NOT PRESENT** |
| `skills/` (repo root) | **NOT PRESENT** |

The repo's `.claude/` directory contains only `settings.local.json` — no project-local skill payloads exist. All skills are user-global.

### User-global

| Surface | Path | Skills | Source / version |
|---|---|---|---|
| Standalone | `~/.claude/skills/` | **20** | Manual / pre-plugin install |
| Plugin | `~/.claude/plugins/cache/claude-plugins-official/vercel/0.40.1/skills/` | **25** | `vercel@claude-plugins-official` v0.40.1 (installed 2026-05-03 09:13Z, sha `b4803ca`) |
| Plugin | `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/` | **14** | `superpowers@claude-plugins-official` v5.0.7 (installed 2026-04-24 12:58Z, sha `6efe32c`) |

**Total skills on disk: 59.**

There is also a leftover install scratch dir at `~/.claude/plugins/cache/temp_git_1777800043341_z1d3gj/` — a git checkout from a plugin install that did not get cleaned up. It is **not** an active skill source (not registered in `installed_plugins.json`). Safe to ignore for this audit; flagged to operator as housekeeping.

---

## Inventory table

### `~/.claude/skills/` (20 skills, user-global standalone)

| Name | Source | Description (one-line) | Size | Last touched |
|------|--------|------------------------|------|--------------|
| accessibility-auditor | standalone | Web accessibility specialist for WCAG compliance, ARIA implementation, and inclusive design. | 12120 | 2026-04-30 |
| bsa-terminology | standalone | Canonical Bowls South Africa (BSA) terminology for all user-facing copy, database enums, UI labels. | 10176 | 2026-04-30 |
| code-reviewer | standalone | Comprehensive code review skill for TypeScript, JavaScript, Python, Swift, Kotlin, Go. | 4396 | 2026-04-30 |
| core-web-vitals | standalone | Optimize Core Web Vitals (LCP, INP, CLS) for better page experience and search ranking. | 11669 | 2026-04-30 |
| frontend-design | standalone | Create distinctive, production-grade frontend interfaces with high design quality. | 4440 | 2026-04-28 |
| handibowls-standards | standalone | Enforces HandiBowls App Review & Update Standards on every code change. | 6457 | 2026-04-28 |
| mobile-design | standalone | Mobile-first design thinking and decision-making for iOS and Android apps. | 15455 | 2026-04-30 |
| nextjs-app-router | standalone | Next.js 16 App Router patterns for HandiBowls — route groups, Server vs Client, middleware role gating. | 8324 | 2026-04-28 |
| phase-discipline | standalone | Enforces the HandiBowls rebuild phase-gated workflow. One phase per session. | 5015 | 2026-04-28 |
| postgres-best-practices | standalone | Postgres performance optimization and best practices from Supabase. | 1887 | 2026-04-30 |
| product-manager-toolkit | standalone | Comprehensive toolkit for product managers — RICE, customer interview analysis, PRD templates. | 8924 | 2026-04-30 |
| react-best-practices | standalone | Comprehensive React and Next.js performance optimization guide with 40+ rules. | 7357 | 2026-04-30 |
| senior-architect | standalone | Comprehensive software architecture skill for designing scalable systems. | 4654 | 2026-04-28 |
| senior-frontend | standalone | Comprehensive frontend development skill for building modern web applications. | 4480 | 2026-04-28 |
| shadcn-tailwind4 | standalone | HandiBowls design-system patterns for Tailwind v4, shadcn/ui (new-york) on React 19, 9 theme presets. | 5736 | 2026-04-28 |
| supabase-migrations | standalone | Patterns for writing, applying, and testing Supabase migrations in HandiBowls. | 5828 | 2026-04-28 |
| ui-design-system | standalone | UI design system toolkit — design token generation, component documentation, responsive calc. | 1060 | 2026-04-28 |
| ui-ux-pro-max | standalone | UI/UX design intelligence — 50 styles, 21 palettes, 50 font pairings, 9 stacks. | 13493 | 2026-04-30 |
| web-performance-optimization | standalone | Optimize website and web application performance — loading speed, CWV, bundle, caching. | 16073 | 2026-04-30 |
| webapp-testing | standalone | Toolkit for interacting with and testing local web applications using Playwright. | 3913 | 2026-04-28 |

### Vercel plugin (25 skills, namespace `vercel:*`)

| Name | Source | Description (one-line) | Size | Last touched |
|------|--------|------------------------|------|--------------|
| vercel:ai-gateway | plugin v0.40.1 | Vercel AI Gateway — model routing, provider failover, cost tracking. | 23772 | 2026-05-03 |
| vercel:ai-sdk | plugin v0.40.1 | Vercel AI SDK — chat, text gen, structured output, tool calling, agents, MCP. | 19820 | 2026-05-03 |
| vercel:auth | plugin v0.40.1 | Authentication integration — Clerk, Descope, Auth0 setup for Next.js. | 11395 | 2026-05-03 |
| vercel:bootstrap | plugin v0.40.1 | Project bootstrapping orchestrator for Vercel-linked resources. | 8022 | 2026-05-03 |
| vercel:chat-sdk | plugin v0.40.1 | Multi-platform chat bots — Slack, Telegram, Teams, Discord, GitHub, Linear. | 13036 | 2026-05-03 |
| vercel:deployments-cicd | plugin v0.40.1 | Vercel deployment + CI/CD — promoting, rolling back, --prebuilt, CI workflows. | 11772 | 2026-05-03 |
| vercel:env-vars | plugin v0.40.1 | Vercel environment variables — .env files, vercel env, OIDC tokens. | 9674 | 2026-05-03 |
| vercel:knowledge-update | plugin v0.40.1 | Corrects outdated LLM knowledge about Vercel platform. Injected at session start. | 4333 | 2026-05-03 |
| vercel:marketplace | plugin v0.40.1 | Vercel Marketplace — discovering, installing, building integrations. | 19420 | 2026-05-03 |
| vercel:next-cache-components | plugin v0.40.1 | Next.js 16 Cache Components — PPR, use cache, cacheLife, cacheTag. | 11721 | 2026-05-03 |
| vercel:next-forge | plugin v0.40.1 | next-forge production-grade Turborepo monorepo SaaS starter. | 9209 | 2026-05-03 |
| vercel:next-upgrade | plugin v0.40.1 | Upgrade Next.js to latest version following migration guides + codemods. | 3459 | 2026-05-03 |
| vercel:nextjs | plugin v0.40.1 | Next.js App Router — routing, Server Components, Server Actions, layouts, middleware. | 17983 | 2026-05-03 |
| vercel:react-best-practices | plugin v0.40.1 | React best-practices reviewer for TSX files — quality checklist after editing components. | 8039 | 2026-05-03 |
| vercel:routing-middleware | plugin v0.40.1 | Vercel Routing Middleware — request interception, rewrites, redirects, personalization. | 11174 | 2026-05-03 |
| vercel:runtime-cache | plugin v0.40.1 | Vercel Runtime Cache API — ephemeral per-region KV cache with tag-based invalidation. | 9210 | 2026-05-03 |
| vercel:shadcn | plugin v0.40.1 | shadcn/ui expert — CLI, component installation, composition, custom registries, theming. | 20117 | 2026-05-03 |
| vercel:turbopack | plugin v0.40.1 | Turbopack expert — configuring Next.js bundler, optimizing HMR, debugging build issues. | 10695 | 2026-05-03 |
| vercel:vercel-agent | plugin v0.40.1 | Vercel Agent — AI-powered code review, incident investigation, SDK installation. | 2921 | 2026-05-03 |
| vercel:vercel-cli | plugin v0.40.1 | Vercel CLI — deploying, env vars, linking projects, viewing logs, managing domains. | 5828 | 2026-05-03 |
| vercel:vercel-functions | plugin v0.40.1 | Vercel Functions — Serverless, Edge, Fluid Compute, streaming, Cron Jobs. | 16150 | 2026-05-03 |
| vercel:vercel-sandbox | plugin v0.40.1 | Vercel Sandbox — ephemeral Firecracker microVMs for running untrusted code. | 11769 | 2026-05-03 |
| vercel:vercel-storage | plugin v0.40.1 | Vercel storage — Blob, Edge Config, Marketplace storage (Neon, Upstash). | 19845 | 2026-05-03 |
| vercel:verification | plugin v0.40.1 | Full-story verification — browser → API → data → response end-to-end. | 7930 | 2026-05-03 |
| vercel:workflow | plugin v0.40.1 | Vercel Workflow DevKit (WDK) — durable workflows, long-running tasks, pause/resume, retries. | 32002 | 2026-05-03 |

### Superpowers plugin (14 skills, namespace `superpowers:*`)

| Name | Source | Description (one-line) | Size | Last touched |
|------|--------|------------------------|------|--------------|
| superpowers:brainstorming | plugin v5.0.7 | MUST use before any creative work — explores user intent, requirements, design before implementation. | 10634 | 2026-04-24 |
| superpowers:dispatching-parallel-agents | plugin v5.0.7 | Use when facing 2+ independent tasks workable without shared state. | 6441 | 2026-04-24 |
| superpowers:executing-plans | plugin v5.0.7 | Use when you have a written implementation plan to execute in a separate session. | 2459 | 2026-04-24 |
| superpowers:finishing-a-development-branch | plugin v5.0.7 | Use when implementation complete + tests pass + need to decide how to integrate. | 4250 | 2026-04-24 |
| superpowers:receiving-code-review | plugin v5.0.7 | Use when receiving code review feedback before implementing suggestions. | 6314 | 2026-04-24 |
| superpowers:requesting-code-review | plugin v5.0.7 | Use when completing tasks, implementing major features, or before merging. | 2935 | 2026-04-24 |
| superpowers:subagent-driven-development | plugin v5.0.7 | Use when executing implementation plans with independent tasks in current session. | 12139 | 2026-04-24 |
| superpowers:systematic-debugging | plugin v5.0.7 | Use when encountering any bug, test failure, or unexpected behavior. | 9884 | 2026-04-24 |
| superpowers:test-driven-development | plugin v5.0.7 | Use when implementing any feature or bugfix, before writing implementation code. | 9867 | 2026-04-24 |
| superpowers:using-git-worktrees | plugin v5.0.7 | Use when starting feature work that needs isolation — creates isolated git worktrees. | 5635 | 2026-04-24 |
| superpowers:using-superpowers | plugin v5.0.7 | Use when starting any conversation — establishes how to find and use skills. | 5421 | 2026-04-24 |
| superpowers:verification-before-completion | plugin v5.0.7 | Use when about to claim work is complete, fixed, or passing. | 4201 | 2026-04-24 |
| superpowers:writing-plans | plugin v5.0.7 | Use when you have a spec or requirements for a multi-step task, before touching code. | 6046 | 2026-04-24 |
| superpowers:writing-skills | plugin v5.0.7 | Use when creating new skills, editing existing skills, or verifying skills work. | 22624 | 2026-04-24 |

All 59 skills carry a valid SKILL.md with a non-empty `description` frontmatter field. No malformed or unreadable skill files encountered.

---

## Classification

### MATCHED (44)

Present on disk **and** explicitly referenced in one of the three reference lists.

#### From userMemories 15-base list (15 of 15 — full intact)

`handibowls-standards`, `phase-discipline`, `shadcn-tailwind4`, `supabase-migrations`, `bsa-terminology`, `nextjs-app-router`, `mobile-design`, `senior-architect`, `react-best-practices`, `webapp-testing`, `senior-frontend`, `ui-ux-pro-max`, `ui-design-system`, `code-reviewer`, `frontend-design`.

#### From Phase-13-lens 5 (4 of 5 — `product-self-knowledge` missing)

`accessibility-auditor`, `web-performance-optimization`, `core-web-vitals`, `postgres-best-practices`.

#### From Vercel plugin 25 (25 of 25)

All 25 `vercel:*` skills present and verified — see plugin inventory table.

### NEW (15)

Present on disk, **not** in any reference list. These were installed since the userMemories list was set.

| Name | Source | Why it's NEW |
|------|--------|--------------|
| `product-manager-toolkit` | standalone | Installed standalone 2026-04-30; possibly intended as `product-self-knowledge` but the names differ. See **Recommended memory update** below. |
| `superpowers:brainstorming` | plugin v5.0.7 | Foundational — superpowers plugin installed 2026-04-24 (after the userMemories list was set). |
| `superpowers:dispatching-parallel-agents` | plugin v5.0.7 | Foundational. |
| `superpowers:executing-plans` | plugin v5.0.7 | Foundational. |
| `superpowers:finishing-a-development-branch` | plugin v5.0.7 | Foundational. |
| `superpowers:receiving-code-review` | plugin v5.0.7 | Foundational. |
| `superpowers:requesting-code-review` | plugin v5.0.7 | Foundational. |
| `superpowers:subagent-driven-development` | plugin v5.0.7 | Foundational. |
| `superpowers:systematic-debugging` | plugin v5.0.7 | Foundational. |
| `superpowers:test-driven-development` | plugin v5.0.7 | Foundational. |
| `superpowers:using-git-worktrees` | plugin v5.0.7 | Foundational. |
| `superpowers:using-superpowers` | plugin v5.0.7 | Loaded by SessionStart hook — bootstraps the Skill tool contract. |
| `superpowers:verification-before-completion` | plugin v5.0.7 | Foundational. |
| `superpowers:writing-plans` | plugin v5.0.7 | Foundational. |
| `superpowers:writing-skills` | plugin v5.0.7 | Foundational. |

The 14 `superpowers:*` skills are best treated as a unit (the foundational layer the system reminder loads at session start) — not as 14 separate decisions, much like the Vercel namespace.

### MISSING (1)

Referenced in a reference list, **not** on disk.

| Name | Where referenced | Closest on-disk candidate | Notes |
|------|------------------|---------------------------|-------|
| `product-self-knowledge` | Phase-13-lens prompts | `product-manager-toolkit` | Different scope: `product-self-knowledge` would imply HandiBowls-specific product mental-model material; `product-manager-toolkit` is generic PM tooling (RICE / interviews / PRD templates). Either install a true `product-self-knowledge` skill (HandiBowls product context) **or** retire the reference and adopt `product-manager-toolkit` if the generic toolkit is what was intended. **Locked decision required at K-prep close.** |

### ORPHANED (0)

A literal repo grep across `.claude/`, `docs/`, recent commit messages, and Markdown for every skill name returned **zero hits for any name** — including the 44 MATCHED ones. This is expected: skills are referenced by the harness's session-reminder list and `Skill` tool invocations, not by repo-resident config. The repo-grep definition in the audit prompt collapses to "everything is orphaned" or "nothing is orphaned" depending on interpretation; we resolve it as **none orphaned** because the reference lists themselves are the active referencing surface.

---

## Cross-skill dependencies

Cross-references found in SKILL.md bodies, target verified against the inventory:

| Source | Target | Target exists? |
|--------|--------|----------------|
| `phase-discipline` | `handibowls-standards` | ✅ present |
| `superpowers:executing-plans` | `superpowers:writing-plans` | ✅ present |
| `superpowers:executing-plans` | `superpowers:subagent-driven-development` | ✅ present |
| `superpowers:executing-plans` | `superpowers:using-git-worktrees` | ✅ present |
| `superpowers:executing-plans` | `superpowers:finishing-a-development-branch` | ✅ present |
| `superpowers:brainstorming` | `superpowers:writing-plans` | ✅ present |
| `superpowers:brainstorming` | `elements-of-style:writing-clearly-and-concisely` | ❌ **broken** — `elements-of-style` plugin is not installed; reference uses "if available" hedge so non-blocking |
| `superpowers:using-superpowers` | `superpowers:brainstorming`, `superpowers:systematic-debugging` | ✅ both present |

The `phase-discipline` SKILL.md mentions the "two-commit rule" pattern but does **not** name `supabase-migrations` directly — the cross-reference is conceptual rather than explicit. Pointer is implicit; no broken-link risk.

**One soft-broken pointer** (`elements-of-style:writing-clearly-and-concisely`); not actionable since superpowers ships the reference with an explicit "if available" guard.

---

## Recommended memory update

The current 15-base userMemories list is **intact** (15 / 15 verified present). The only update worth pushing is to acknowledge the two new foundational layers (Vercel plugin + superpowers plugin) and resolve the `product-self-knowledge` vs `product-manager-toolkit` ambiguity.

### Suggested replacement wording for userMemories skill list

> **Skills available in this session.**
>
> Three layers:
>
> 1. **HandiBowls + general standalone (20 skills, `~/.claude/skills/`)** — `handibowls-standards`, `phase-discipline`, `shadcn-tailwind4`, `supabase-migrations`, `bsa-terminology`, `nextjs-app-router`, `mobile-design`, `senior-architect`, `react-best-practices`, `webapp-testing`, `senior-frontend`, `ui-ux-pro-max`, `ui-design-system`, `code-reviewer`, `frontend-design`, `accessibility-auditor`, `web-performance-optimization`, `core-web-vitals`, `postgres-best-practices`, `product-manager-toolkit`.
> 2. **Vercel plugin (`vercel:*`, 25 skills)** — installed `vercel@claude-plugins-official` v0.40.1 on 2026-05-03; covers the full Vercel surface (deploy, CLI, functions, AI SDK, AI Gateway, storage, marketplace, etc.). Reference collectively as `vercel:*` rather than enumerating; invoke individual skills by namespace when relevant.
> 3. **Superpowers plugin (`superpowers:*`, 14 skills)** — installed `superpowers@claude-plugins-official` v5.0.7 on 2026-04-24; foundational workflow skills (brainstorming, writing-plans, executing-plans, TDD, debugging, code review, git worktrees, etc.). The session-start `using-superpowers` skill establishes the Skill-tool contract.
>
> **Pending decision:** the 5-skill "Phase-13-lens" set referenced `product-self-knowledge` which is not on disk. `product-manager-toolkit` is present but covers generic PM tooling, not HandiBowls product context. Either install / write a true `product-self-knowledge` skill (HandiBowls-specific product mental-model material) before 13-6 (content + copy polish opens), or retire the reference. Resolve at K-prep close.

This update can be applied via `auto memory` once approved — saves to a single memory file, replaces the existing 15-base list pointer.

---

## Open items for human decision

1. **`product-self-knowledge` reference resolution** — install a real skill, or retire the reference + adopt `product-manager-toolkit` as the canonical PM-flavoured skill? Affects Phase 13 / 13-6 (content + copy polish, onboarding checklists, /help articles) where product mental-model context matters most.
2. **Vercel plugin keep / remove** — already tracked in auto-memory at `phase-13-7-vercel-plugin.md` for evaluation before 13-8 close. This audit confirms the install is clean, no duplicate-named skills, no broken cross-refs.
3. **Superpowers plugin keep / remove** — not currently tracked. The 14 skills add a foundational workflow layer; recommend explicit decision at the same checkpoint as Vercel plugin (13-7 → 13-8 boundary).
4. **Housekeeping:** `~/.claude/plugins/cache/temp_git_1777800043341_z1d3gj/` is leftover plugin-install scratch. Safe to remove via `rm -rf` (not registered in `installed_plugins.json`). Operator-side cleanup, not blocking.

---

## Audit trail

- Read-only enumeration via `find` + `stat` + `grep` — no skill files modified, installed, or removed.
- Counts verified independently per surface (`ls -d ... | wc -l`): standalone 20, vercel 25, superpowers 14 = **59 total**.
- Cross-skill dependency check covered all 59 SKILL.md files via `grep -F` substring match (hyphenated skill names broke the original `\b` word-boundary regex; corrected during audit).
- Reference list provenance — userMemories 15-base from user-supplied prompt; Phase-13-lens 5 from user-supplied prompt; Vercel 25 from installed plugin manifest at `~/.claude/plugins/cache/claude-plugins-official/vercel/0.40.1/skills/`.
