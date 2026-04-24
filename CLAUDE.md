## Research gate (non-negotiable)

Before using any Next.js App Router, Supabase, shadcn, Tailwind, Zod, TanStack, Playwright, Serwist, or Dexie API, invoke Context7 (`use context7`) to fetch current docs. Do not infer API shapes from training data — training data is stale for every one of those libraries and has caused silent production bugs in this project (Zod 4 → hookform/resolvers, Supabase SSR race, THEME_PRESETS client-module taint).

If Context7 is unavailable for a specific library, say so in plain English and ask for guidance — do not guess.

This rule applies to every new code path. It does NOT apply to code that already exists and is just being read or refactored — only when introducing a new API call or pattern.
