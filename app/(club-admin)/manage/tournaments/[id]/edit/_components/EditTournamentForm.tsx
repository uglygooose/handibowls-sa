"use client";

import { AlertCircle, Check, Lock, MapPin, RefreshCw, Save, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { FormatPicker } from "@/components/tournament/FormatPicker";
import { StructurePicker } from "@/components/tournament/StructurePicker";
import { updateTournament } from "@/app/(club-admin)/manage/tournaments/_actions";
import {
  Chip,
  ChipRow,
  Field,
  inputClass,
  Section,
} from "@/app/(club-admin)/manage/tournaments/_components/form-shell";
import { FORMAT_DEFAULTS, type TournamentFormat } from "@/lib/tournaments/formats";
import {
  AGE_GROUPS,
  CATEGORIES,
  HANDICAP_RULES,
  SEEDING_METHODS,
  TOURNAMENT_SCOPES,
  type UpdateTournamentInput,
} from "@/lib/validation/tournaments";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

// Phase 12.5 / 12.5-5 — edit-mode counterpart to <NewTournamentForm>.
// Mirrors the create form's 4-section structure pre-filled from the
// existing tournament row. Three edit-specific concerns layered on
// top of the create flow:
//
//   1. Format-locked. The format + structure pickers + their auto-
//      derived rule fields freeze with an inline notice card once
//      `tournamentHasScores(id)` returns true (Section 01 + 02).
//      Server-side gate in updateTournament re-validates on save;
//      this is the proactive UI guard.
//
//   2. Rename soft-warn. When the row is published (status='open' or
//      'in_progress'), edits to the name field surface inline helper
//      text noting that public tournament links update. Locked
//      decision: rename allowed even after publish.
//
//   3. Optimistic concurrency. The pre-filled form carries the row's
//      `updated_at` at load time as `expected_updated_at`. The
//      action's UPDATE filters on it; concurrent edits collide as a
//      stale response which the form surfaces as an inline error +
//      Reload affordance. Successful saves rebase
//      `expectedUpdatedAt` to the freshly-bumped value so subsequent
//      saves in the same session don't false-positive.

type Scope = (typeof TOURNAMENT_SCOPES)[number];
type Category = (typeof CATEGORIES)[number];
type AgeGroup = (typeof AGE_GROUPS)[number];
type HandicapRule = (typeof HANDICAP_RULES)[number];
type SeedingMethod = (typeof SEEDING_METHODS)[number];
type Structure = Database["public"]["Enums"]["tournament_structure"];

type Green = { id: string; name: string; rink_count: number };

export type EditTournament = {
  id: string;
  name: string;
  scope: Scope;
  format: TournamentFormat;
  structure: Structure;
  category: Category;
  age_group: AgeGroup;
  handicap_rule: HandicapRule;
  seeding_method: SeedingMethod;
  starts_at: string | null;
  ends_at: string | null;
  entries_close_at: string | null;
  max_entries: number | null;
  ends_per_match: number | null;
  shots_up_target: number | null;
  fair_rink: boolean;
  updated_at: string;
  host_club: { id: string; name: string };
};

type Props = {
  tournament: EditTournament;
  greens: Green[];
  selectedGreenIds: string[];
  formatLocked: boolean;
  softWarnRename: boolean;
};

const CATEGORY_OPTIONS: { id: Category; label: string }[] = [
  { id: "men", label: "Men" },
  { id: "women", label: "Women" },
  { id: "mixed", label: "Mixed" },
  { id: "open", label: "Open" },
];

const AGE_OPTIONS: { id: AgeGroup; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "veteran", label: "Veteran" },
  { id: "junior", label: "Junior" },
  { id: "u35", label: "U35" },
];

const SCOPE_OPTIONS: { id: Scope; label: string }[] = [
  { id: "club", label: "Club" },
  { id: "district", label: "District" },
  { id: "national", label: "National" },
];

const SEEDING_OPTIONS: { id: SeedingMethod; label: string; locked?: boolean }[] = [
  { id: "random", label: "Random" },
  { id: "seeded", label: "Seeded (manual)" },
  { id: "sectional", label: "Sectional", locked: true },
];

// `<input type="datetime-local">` wants `YYYY-MM-DDTHH:MM` in local
// time; `<input type="date">` wants `YYYY-MM-DD`. The DB row carries
// ISO strings (UTC). These two helpers convert one direction; on
// submit the existing toIsoOrNull pattern goes back to ISO.
function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Local-zone components — same convention `<input type="datetime-local">` uses.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function isoToDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toIsoOrNull(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function EditTournamentForm({
  tournament,
  greens,
  selectedGreenIds,
  formatLocked,
  softWarnRename,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // -------- form state — pre-filled from the row --------
  const [name, setName] = useState(tournament.name);
  const [scope, setScope] = useState<Scope>(tournament.scope);
  const [format, setFormat] = useState<TournamentFormat>(tournament.format);
  const [structure, setStructure] = useState<Structure>(tournament.structure);
  const [category, setCategory] = useState<Category>(tournament.category);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(tournament.age_group);
  const [handicapRule, setHandicapRule] = useState<HandicapRule>(
    tournament.handicap_rule,
  );
  const [seedingMethod, setSeedingMethod] = useState<SeedingMethod>(
    tournament.seeding_method,
  );
  const [startsAt, setStartsAt] = useState(isoToDate(tournament.starts_at));
  const [endsAt, setEndsAt] = useState(isoToDate(tournament.ends_at));
  const [entriesCloseAt, setEntriesCloseAt] = useState(
    isoToDatetimeLocal(tournament.entries_close_at),
  );
  const [maxEntries, setMaxEntries] = useState<string>(
    tournament.max_entries != null ? String(tournament.max_entries) : "",
  );
  const [selectedGreens, setSelectedGreens] = useState<Set<string>>(
    () => new Set(selectedGreenIds),
  );
  const [fairRink, setFairRink] = useState(tournament.fair_rink);
  // Entry fee remains visual-only (placeholder per Section 04).
  const [entryFee, setEntryFee] = useState("80.00");

  // expectedUpdatedAt rebases on every successful save so a second
  // save in the same session passes the optimistic-lock check.
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(
    tournament.updated_at,
  );

  const [serverError, setServerError] = useState<string | null>(null);
  const [staleError, setStaleError] = useState<{
    currentUpdatedAt: string | null;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const formatDefaults = useMemo(() => FORMAT_DEFAULTS[format], [format]);

  const valid = name.trim().length >= 2 && Boolean(format) && Boolean(structure);
  const nameChangedFromInitial = name.trim() !== tournament.name.trim();
  const showRenameWarn = softWarnRename && nameChangedFromInitial;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || pending) return;
    setServerError(null);
    setStaleError(null);
    setFieldErrors({});

    const payload: UpdateTournamentInput = {
      tournament_id: tournament.id,
      expected_updated_at: expectedUpdatedAt,
      name: name.trim(),
      scope,
      format,
      structure,
      category,
      age_group: ageGroup,
      handicap_rule: handicapRule,
      seeding_method: seedingMethod,
      starts_at: toIsoOrNull(startsAt),
      ends_at: toIsoOrNull(endsAt),
      entries_close_at: toIsoOrNull(entriesCloseAt),
      max_entries: maxEntries ? Number(maxEntries) : null,
      fair_rink: fairRink,
      green_ids: Array.from(selectedGreens),
    };

    startTransition(async () => {
      const result = await updateTournament(payload);
      if (result.ok) {
        // Rebase the optimistic-lock value so a second save in the
        // same session doesn't false-positive as stale.
        setExpectedUpdatedAt(result.data.updated_at);
        // Refresh the cached server-rendered detail page on the
        // back-nav target (revalidatePath in the action handles
        // the revalidate; router.refresh forces this client to
        // re-fetch any cached snapshot).
        router.refresh();
        router.push(`/manage/tournaments/${tournament.id}`);
        return;
      }
      if (result.code === "stale") {
        setStaleError({ currentUpdatedAt: result.currentUpdatedAt ?? null });
        return;
      }
      setServerError(result.error);
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24"
    >
      <AdminPageHero
        eyebrow="Edit · Tournament"
        title="Edit tournament"
        description="Adjust the configuration. Format and structure lock once a match has been scored."
        speckle={{ seed: `edit-hero-${tournament.id}`, density: "med", opacity: 0.05 }}
        splatter={{ preset: "atomic-red", variant: 0, size: "L", rotate: 20, opacity: 0.5 }}
        actions={
          <Link
            href={`/manage/tournaments/${tournament.id}`}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
            Discard
          </Link>
        }
        containerWidth="none"
      />

      {/* Sections card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {/* Section 01 — Basics */}
        <Section index="01" title="Basics" desc="Identity, dates, and the format your players will compete in.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <Field
              label="Tournament name"
              required
              error={fieldErrors.name?.[0]}
              helper={
                showRenameWarn
                  ? "Public tournament links update when the name changes."
                  : undefined
              }
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                data-slot="edit-name-input"
              />
            </Field>
            <Field label="Starts on">
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Ends on">
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field
              label="Entries close at"
              helper="Leave empty to keep entries open until manually closed."
            >
              <input
                type="datetime-local"
                value={entriesCloseAt}
                onChange={(e) => setEntriesCloseAt(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Max entries">
              <input
                type="number"
                min={1}
                value={maxEntries}
                onChange={(e) => setMaxEntries(e.target.value)}
                className={cn(inputClass, "tabular-nums")}
              />
            </Field>
            <Field label="Scope">
              <ChipRow>
                {SCOPE_OPTIONS.map((o) => (
                  <Chip
                    key={o.id}
                    active={scope === o.id}
                    onClick={() => setScope(o.id)}
                  >
                    {o.label}
                  </Chip>
                ))}
              </ChipRow>
            </Field>
          </div>

          {formatLocked && (
            <div
              data-slot="format-locked-notice"
              className="flex items-start gap-2.5 rounded-xl border border-danger-500/40 bg-danger-500/5 px-4 py-3"
            >
              <Lock className="mt-0.5 size-4 shrink-0 text-danger-500" aria-hidden="true" />
              <div className="flex-1 text-[13px] leading-[1.45]">
                <strong className="text-ink">Format and structure are locked.</strong>{" "}
                <span className="text-ink-muted">
                  Once a match has been scored, the tournament&apos;s format
                  and structure can&apos;t change — moving the bracket shape
                  mid-event would invalidate live scores.
                </span>
              </div>
            </div>
          )}

          <Field label="Format" required error={fieldErrors.format?.[0]}>
            <FormatPicker
              value={format}
              onChange={(f) => !formatLocked && setFormat(f)}
              disabled={formatLocked}
            />
          </Field>

          <Field label="Structure" required error={fieldErrors.structure?.[0]}>
            <StructurePicker
              value={structure}
              onChange={(s) => !formatLocked && setStructure(s)}
              disabled={formatLocked}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category">
              <ChipRow>
                {CATEGORY_OPTIONS.map((o) => (
                  <Chip
                    key={o.id}
                    active={category === o.id}
                    onClick={() => setCategory(o.id)}
                  >
                    {o.label}
                  </Chip>
                ))}
              </ChipRow>
            </Field>
            <Field label="Age group">
              <ChipRow>
                {AGE_OPTIONS.map((o) => (
                  <Chip
                    key={o.id}
                    active={ageGroup === o.id}
                    onClick={() => setAgeGroup(o.id)}
                  >
                    {o.label}
                  </Chip>
                ))}
              </ChipRow>
            </Field>
          </div>
        </Section>

        {/* Section 02 — Rules */}
        <Section
          index="02"
          title="Rules"
          desc="Auto-filled from format defaults. Tweak only if your event diverges from BSA."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label="Bowls per player">
              <input
                type="number"
                value={formatDefaults.bowlsPerPlayer}
                placeholder="—"
                disabled
                className={cn(inputClass, "tabular-nums")}
              />
            </Field>
            <Field label="Scoring model">
              <select
                value={formatDefaults.scoringModel}
                disabled
                className={inputClass}
              >
                <option value="shots_up">Shots up</option>
                <option value="fixed_ends">Fixed ends</option>
              </select>
            </Field>
            <Field label="Shots target">
              <input
                type="number"
                value={
                  formatDefaults.scoringModel === "shots_up"
                    ? formatDefaults.shotsTarget
                    : ""
                }
                placeholder="—"
                disabled
                className={cn(inputClass, "tabular-nums")}
              />
            </Field>
            <Field label="Ends target">
              <input
                type="number"
                value={
                  formatDefaults.scoringModel === "fixed_ends"
                    ? formatDefaults.endsTarget
                    : ""
                }
                placeholder="—"
                disabled
                className={cn(inputClass, "tabular-nums")}
              />
            </Field>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted p-4">
            <Field label="Handicap rule">
              <ChipRow>
                <Chip
                  active={handicapRule === "scratch"}
                  onClick={() => setHandicapRule("scratch")}
                >
                  Scratch (default)
                </Chip>
                <Chip
                  active={handicapRule === "handicap_start"}
                  onClick={() => setHandicapRule("handicap_start")}
                >
                  Handicap start
                </Chip>
              </ChipRow>
            </Field>
            <div className="mt-3 rounded-md bg-bone px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-muted">
              <strong className="text-ink">Handicap start</strong> gives
              weaker players a starting-shot advantage. Club-internal only —
              not endorsed by BSA.
            </div>
          </div>
        </Section>

        {/* Section 03 — Seeding & Greens */}
        <Section
          index="03"
          title="Seeding & Greens"
          desc="Decide how the bracket is populated and which surfaces are in play."
        >
          <Field label="Seeding method">
            <ChipRow>
              {SEEDING_OPTIONS.map((o) => (
                <Chip
                  key={o.id}
                  active={seedingMethod === o.id && !o.locked}
                  locked={o.locked}
                  title={o.locked ? "Coming in a later release" : undefined}
                  onClick={() => !o.locked && setSeedingMethod(o.id)}
                >
                  {o.label}
                </Chip>
              ))}
            </ChipRow>
          </Field>

          <Field
            label="Greens to use"
            helper="Selected greens scope which surfaces the rink-fairness algorithm picks from at match scheduling."
          >
            <ChipRow>
              {greens.length === 0 ? (
                <span className="text-[12px] italic text-ink-subtle">
                  No active greens for this club. Add some on /manage/greens.
                </span>
              ) : (
                greens.map((g) => {
                  const active = selectedGreens.has(g.id);
                  return (
                    <Chip
                      key={g.id}
                      active={active}
                      onClick={() => {
                        const next = new Set(selectedGreens);
                        if (next.has(g.id)) next.delete(g.id);
                        else next.add(g.id);
                        setSelectedGreens(next);
                      }}
                    >
                      <MapPin className="size-3" aria-hidden="true" />
                      {g.name}
                      <span className="ml-1 font-mono text-[11px] opacity-70">
                        {g.rink_count} rinks
                      </span>
                    </Chip>
                  );
                })
              )}
            </ChipRow>
          </Field>

          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3.5">
            <div>
              <div className="text-[14px] font-semibold">
                Fair Rink allocation
              </div>
              <div className="mt-0.5 text-[13px] text-ink-muted">
                Spread teams evenly across rinks; bias against repeats.
                Recommended.
              </div>
            </div>
            <label className="relative inline-flex h-6 w-11 cursor-pointer items-center">
              <input
                type="checkbox"
                checked={fairRink}
                onChange={(e) => setFairRink(e.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-surface-muted ring-1 ring-inset ring-border transition-colors peer-checked:bg-primary-500"
              />
              <span
                aria-hidden="true"
                className="relative ml-0.5 size-5 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-5"
              />
            </label>
          </div>
        </Section>

        {/* Section 04 — Entry fee placeholder */}
        <Section
          index="04"
          title={
            <>
              Entry fee{" "}
              <span className="ml-1 align-baseline text-[13px] font-normal normal-case tracking-normal text-ink-subtle">
                (placeholder)
              </span>
            </>
          }
          desc="Display-only for now. Payment collection arrives later."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[260px_1fr] sm:items-start">
            <Field label="Entry fee (ZAR)">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-ink-muted">
                  R
                </span>
                <input
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  className={cn(inputClass, "pl-7 tabular-nums")}
                />
              </div>
            </Field>
            <div className="rounded-xl border border-dashed border-border bg-surface-muted p-3.5">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="size-4 shrink-0 text-warning-500" />
                <strong className="text-[13px]">
                  Payment collection coming soon
                </strong>
              </div>
              <p className="mt-1 text-[13px] text-ink-muted">
                Fees are displayed on the entry page only — players won&apos;t be
                charged through HandiBowls in v1.
              </p>
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-7 py-5">
          <div className="flex-1 text-[12px] text-ink-subtle">
            {staleError ? (
              <span
                data-slot="stale-edit-error"
                className="inline-flex items-center gap-1.5 text-danger-500"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Tournament was edited in another session. Reload the page to
                see the latest version before saving.
              </span>
            ) : serverError ? (
              <span className="text-danger-500">{serverError}</span>
            ) : valid ? (
              <span className="inline-flex items-center gap-1.5 text-success-500">
                <Check className="size-3.5" aria-hidden="true" />
                Required fields complete — ready to save
              </span>
            ) : (
              <span>Fill required fields (name, format, structure) to continue.</span>
            )}
          </div>
          <Link
            href={`/manage/tournaments/${tournament.id}`}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            Discard
          </Link>
          <button
            type="submit"
            disabled={!valid || pending}
            data-slot="save-changes-cta"
            className={cn(
              "inline-flex h-14 items-center gap-2 rounded-lg bg-primary-500 px-6 text-base font-semibold text-[color:var(--color-on-primary)] shadow-sm transition-colors hover:bg-primary-600",
              (!valid || pending) && "cursor-not-allowed opacity-60",
            )}
          >
            <Save className="size-4" aria-hidden="true" />
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
