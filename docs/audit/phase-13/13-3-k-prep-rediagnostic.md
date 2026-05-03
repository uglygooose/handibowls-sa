# Phase 13 / 13-3 — K-prep rediagnostic

**Branch tip at audit:** `7faeca0` (`rebuild/phase-13-launch-prep`).
**Source:** axe node detail extracted from `docs/audit/phase-13/baseline-13-1-m3-residual-sweep.json` (M3 baseline at SHA `dd5dbfc`, captured 2026-05-02 17:22:07Z against Vercel preview `handibowls-ee9iwpvd5-andrews-projects-a0c14c4f.vercel.app`).
**Scope:** Option 1 re-pull only — no fresh Vercel deploy, no code changes.

---

## The 3 axe-serious nodes on /me

Identical violation, three sibling nodes — `:nth-child(1)`, `:nth-child(2)`, `:nth-child(3)` of the same parent.

| # | Target selector (axe) | Rendered element |
|---|----------------------|------------------|
| 1 | `.border-l-4.p-3.border-l-border:nth-child(1) > .flex-wrap.gap-1\.5.items-center > .tracking-\[0\.04em\].text-ink-muted[data-slot="party-meta"]` | `<span data-slot="party-meta" class="font-mono text-[11px] font-bold uppercase tracking-[0.04em] text-ink-muted">· 6 bowlers</span>` |
| 2 | …`:nth-child(2)` > … same descendant selector | `<span … >· 2 bowlers</span>` |
| 3 | …`:nth-child(3)` > … same descendant selector | `<span … >· 1 bowlers</span>` |

**axe-reported computed colours (identical across all 3 nodes):**

```
Element has insufficient color contrast of 3.13
  foreground: #90908f
  background: #fdfdfc
  font size: 8.3pt (11px)
  font weight: bold
  Expected contrast ratio of 4.5:1
```

**Source component:** `components/player/MyBookings.tsx:144-151` — the party-meta `<span>` rendered inside the `<li data-slot="booking-row">` row when `row.party_size != null`.

**Wired-in route:** `/me` mounts `<MyBookings>` at `app/(player)/(gated)/me/page.tsx:205`.

---

## Real failure cause — parent-opacity cascade, not a token problem

The element class chain (`text-ink-muted`) resolves to `--color-ink-muted` → `--ink-muted` → **`#4a4a4a`** at `app/globals.css:140`. On `bg-bone` (`#ffffff`) that's a clean ~8.5:1 — passes AA easily. So the element-level token is fine.

But the `<li>` parent at `MyBookings.tsx:114-123` carries this conditional class:

```tsx
className={cn(
  "rounded-xl border border-l-4 border-border bg-bone p-3",
  row.is_past
    ? "border-l-border opacity-60"
    : "border-l-primary-500",
)}
```

When `row.is_past === true`, the entire `<li>` gets `opacity-60` (Tailwind = α 0.6). This composites **both** the row's `bg-bone` AND every descendant text colour against the underlying page background (`bg-surface` = `#fafaf7`).

The arithmetic exactly reproduces axe's reported colours:

| Element | Token (declared) | Composite formula | Computed |
|---------|------------------|-------------------|----------|
| Foreground (party-meta text) | `#4a4a4a` (74,74,74) | 0.6 × 74 + 0.4 × 250 = 145.6 | **`#90908f`** (axe rounding) |
| Background (row bg) | `#ffffff` (255,255,255) | 0.6 × 255 + 0.4 × 250 = 253 | **`#fdfdfc`** ✓ |

Composited contrast = (Y_bg + 0.05) / (Y_fg + 0.05) ≈ 1.019 / 0.332 = **3.07** — matches axe's 3.13 within the standard sRGB-to-luminance rounding tolerance.

**Selector confirmation:** axe's chain includes the literal class `.border-l-border` as part of the parent — and `border-l-border` is *only* present on the `is_past` branch (line 121). So all 3 axe-flagged nodes are **past bookings rendered with `opacity-60`**, not future-row siblings (which get `border-l-primary-500` and no opacity).

### Why the original DRIFT-L291 entry got it wrong

The entry attributed the rendered `#90908f` to a per-preset `--ink-muted` override on 7-of-9 themes. That override doesn't exist anywhere in `globals.css` (verified with `grep -cE "^\s*--ink-muted" app/globals.css` → 1). The `#90908f` value IS what axe sees in the live render, but the cause is parent `opacity-60`, not a theme-scoped token. The entry conflated rendered hex with token hex.

---

## Implications for Batch K — recommended scope

**Token swap is the wrong fix.** If we tighten `--ink-muted` from `#4a4a4a` to clear AA *under parent opacity-60* on bg-surface, the token has to drop to roughly `#1a1a1a` (basically pure black). That over-darkens every other `text-ink-muted` callsite where there is no parent opacity (≈130 calls site-wide, mostly on bone/surface where #4a4a4a already passes at 8.5:1). Tested algebra:

| Candidate token | Composited fg under α=0.6 over #fafaf7 | vs composited bg #fdfdfc | AA verdict |
|-----------------|---------------------------------------:|:-------------------------|:-----------|
| `#4a4a4a` (current) | `#90908f` (Y≈0.282) | bg Y≈0.969 → **3.13:1** | fails |
| `#404040` | `#8c8c8b` (Y≈0.265) | → 3.30:1 | fails |
| `#2e2e2e` | `#828281` (Y≈0.225) | → 3.83:1 | fails |
| `#1a1a1a` | `#777776` (Y≈0.182) | → **4.55:1** | passes (just) |
| `#000000` | `#6f6f6e` (Y≈0.157) | → 5.05:1 | passes |

A token at `#1a1a1a` darkens unmodified `text-ink-muted` on bone from 8.5:1 to **~16:1** — visually almost identical to `text-ink` (which is `#0a0a0a`). That collapses the visual hierarchy between `text-ink` and `text-ink-muted` everywhere else in the app to clear AA on a single dimming pattern. Bad trade.

**The right fix is at the dimming pattern itself.** Three options ranked by visual impact / fidelity to the existing 12.5 token-driven chrome rule:

### Option A — Replace `opacity-60` with explicit muted tokens on past rows *(recommended)*

Token-driven, theme-invariant, no compositing surprises. On `is_past=true`:

- Drop `opacity-60` from the `<li>`.
- Apply `bg-surface-muted` (instead of `bg-bone`) to dim the row visually.
- Apply `text-ink-subtle` to the `data-slot="when-label"` heading (already `text-ink` — bumps it down one tier).
- Leave `text-ink-muted` on the party-meta as-is; it now renders at its declared 8.5:1 on bone (or ~7.9:1 on `bg-surface-muted`, both pass).
- Optional: add a `data-past="true"` outline (`outline-dotted outline-border`) for the de-emphasis cue.

This honours the **"theme tokens drive chrome, not opacity hacks"** rule from 12.5 unification + your locked decision. Scope: **single component file** (`MyBookings.tsx`), maybe **3-5 lines** changed.

### Option B — Bump `opacity-60` to `opacity-80`

Lowest-touch fix. At α=0.8: composite fg `#6d6d6d` on composite bg `#fefefd` → ~5.0:1, passes AA. Visual de-emphasis weakens (past rows look closer to active rows) but still distinguishable. Scope: **1 line** changed.

Caveat: `opacity-80` is on the edge of "looks dimmed" vs "looks active". A user QA pass would tell whether the past-row signal still reads. Also, `opacity-70` does NOT pass (composite ≈3.9:1) — so `80` is the minimum safe value.

### Option C — Ship as-is, mark DRIFT-L291 as a documented known issue

Past bookings on /me display at 3.13:1 on the secondary-info text only. The primary `data-slot="when-label"` text at `text-ink` composites to ~7.0:1 (still passes AA at α=0.6 because #0a0a0a is dark enough). Practical UX impact is low — past bookings are by definition de-emphasised informational rows. But it leaves a documented WCAG AA failure on /me, which is a launch-checklist item.

### My recommendation

**Option A.** It clears AA without touching a single token, eliminates the cascade-on-text class-of-bug at its root, and aligns with the existing 12.5 design rule. Scope is narrow (one file, a handful of lines) and the test surface is small (a Playwright/axe run on /me with past-bookings-present fixtures).

---

## Class-of-bug — other parent-opacity-over-text sites

The `opacity-N` on a parent that contains body text is a recurring pattern. Known sites that may exhibit similar AA failures (not yet axe-confirmed; depends on whether they cover a text node and whether the underlying contrast is borderline):

| File:line | Pattern | Likely scope |
|-----------|---------|--------------|
| `app/(player)/(gated)/book/_components/SlotList.tsx:142` | `bg-surface-muted opacity-70` for fully-booked rows | Same shape as MyBookings is_past — at risk if list contains text-ink-muted children |
| `app/(player)/(gated)/book/_components/DateStrip.tsx:43` | `opacity-40` for closed dates | Highest risk — α=0.4 composite of any text against any bg almost certainly fails AA |
| `app/(super-admin)/platform/users/_components/UsersTable.tsx:150,160` | `pointer-events-none opacity-50` on disabled pagination | Disabled state → axe usually exempts but worth confirming |
| `app/(super-admin)/platform/clubs/_components/ClubsTable.tsx:258,268` | Same disabled-pagination pattern | Same |
| `app/(club-admin)/manage/tournaments/new/_components/NewTournamentForm.tsx:552` | `cursor-not-allowed opacity-60` on disabled submit | Disabled state |
| `app/(club-admin)/manage/tournaments/[id]/_components/TournamentHero.tsx:153` | `cursor-not-allowed opacity-60` on disabled CTA | Disabled state |

The disabled-state opacity callers (`pointer-events-none opacity-50`, `cursor-not-allowed opacity-60`) are conventional and axe usually treats them as an exempt state — but DateStrip's `opacity-40` for closed dates is a non-disabled body-text dimming that mirrors the MyBookings pattern. Worth axe-confirming during Batch K execution if the user wants the class-of-bug closed in one sweep rather than just /me.

---

## Recommended Batch K execution scope

**Shape:** parent-opacity-replacement, not token-tightening.

**Scope estimate:** **S** for /me-only fix (Option A applied to MyBookings.tsx — single file, ~5 lines, +Playwright/axe verification on /me with past-bookings-present fixture).

**Scope estimate if extended to the class-of-bug:** **S→M** if SlotList + DateStrip get the same treatment (3 files, ~10-15 lines, +axe runs on /book and any closed-date fixture). The disabled-state pagination/CTA callers stay out of scope (axe-exempt).

**DRIFT-L291 disposition:** **CORRECT-IN-PLACE.** The entry's underlying observation (3 axe-serious nodes on /me, 3.13:1) is real; the diagnosis (per-preset `#90908f` on 7-of-9 themes) is wrong. Update the entry's body to point at the parent-opacity-cascade root cause, retain the 13-3 owner annotation, retire the "token-tightening pass with explicit before/after ratios per preset" acceptance criterion, replace with the Option A acceptance criterion (axe re-run on /me with past-bookings shows zero serious nodes; `--ink-muted` token left at `#4a4a4a` unchanged).

**Pre-K execution gates remaining:**
- User pick between Options A / B / C above (or a different shape).
- User decide whether Batch K covers /me only or extends to the class-of-bug (SlotList, DateStrip).
- Once shape locked: code change → Playwright fixture for past-bookings → fresh Vercel preview deploy → `baseline-13-1.mjs --label=k-execution --surfaces=me` (and `--surfaces=me,book` if extended) → confirm post-count = 0 serious on flagged surfaces.

No fresh Vercel deploy executed during K-prep rediagnostic per scope.
