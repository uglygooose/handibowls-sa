"use client";

import { AlertCircle, Check, MapPin, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import { FormatPicker } from "@/components/tournament/FormatPicker";
import { StructurePicker } from "@/components/tournament/StructurePicker";
import { createTournament } from "@/app/(club-admin)/manage/tournaments/_actions";
import { FORMAT_DEFAULTS, type TournamentFormat } from "@/lib/tournaments/formats";
import {
  AGE_GROUPS,
  CATEGORIES,
  HANDICAP_RULES,
  SEEDING_METHODS,
  TOURNAMENT_SCOPES,
  type CreateTournamentInput,
} from "@/lib/validation/tournaments";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type Scope = (typeof TOURNAMENT_SCOPES)[number];
type Category = (typeof CATEGORIES)[number];
type AgeGroup = (typeof AGE_GROUPS)[number];
type HandicapRule = (typeof HANDICAP_RULES)[number];
type SeedingMethod = (typeof SEEDING_METHODS)[number];
type Structure = Database["public"]["Enums"]["tournament_structure"];

type Green = { id: string; name: string; rink_count: number };

type Props = {
  hostClub: { id: string; name: string };
  greens: Green[];
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

export function NewTournamentForm({ hostClub, greens }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // -------- form state ----------
  const [name, setName] = useState("");
  const [scope, setScope] = useState<Scope>("club");
  const [format, setFormat] = useState<TournamentFormat | "">("");
  const [structure, setStructure] = useState<Structure | "">("");
  const [category, setCategory] = useState<Category>("open");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("open");
  const [handicapRule, setHandicapRule] = useState<HandicapRule>("scratch");
  const [seedingMethod, setSeedingMethod] = useState<SeedingMethod>("random");
  const [startsAt, setStartsAt] = useState<string>("");
  const [endsAt, setEndsAt] = useState<string>("");
  const [entriesCloseAt, setEntriesCloseAt] = useState<string>("");
  const [maxEntries, setMaxEntries] = useState<string>("32");
  // Greens picker + Fair-Rink toggle persist as of migration 039.
  // Default selection is "all active club greens" so the form's empty
  // submit still results in the rink-fairness algorithm having
  // candidates to pick from. The toggle's default (true) matches the
  // schema default — the column is set explicitly anyway in case the
  // user toggles off.
  const [selectedGreens, setSelectedGreens] = useState<Set<string>>(
    () => new Set(greens.map((g) => g.id)),
  );
  const [fairRink, setFairRink] = useState(true);
  // Entry fee remains visual-only (a separate Phase 12.5 follow-up
  // tracks payment collection — entry-fee placeholder card on this
  // form is the surface).
  const [entryFee, setEntryFee] = useState("80.00");

  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const formatDefaults = useMemo(
    () => (format ? FORMAT_DEFAULTS[format] : null),
    [format],
  );

  const valid = name.trim().length >= 2 && Boolean(format) && Boolean(structure);

  function toIsoOrNull(local: string): string | null {
    if (!local) return null;
    // datetime-local inputs lack timezone; assume the user's local zone and
    // convert to ISO-Z for the server. Date-only inputs (yyyy-mm-dd) get
    // anchored to local-midnight.
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || pending) return;
    setServerError(null);
    setFieldErrors({});

    const payload: CreateTournamentInput = {
      host_club_id: hostClub.id,
      name: name.trim(),
      scope,
      format: format as TournamentFormat,
      structure: structure as Structure,
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
      const result = await createTournament(payload);
      if (result.ok) {
        router.push(`/manage/tournaments/${result.data.tournament_id}`);
        return;
      }
      setServerError(result.error);
      if ("fieldErrors" in result && result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-[1100px] flex-col gap-6 px-8 py-6"
    >
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface px-8 py-7">
        <div className="pointer-events-none absolute inset-0 z-0">
          <SpeckleLayer seed="new-hero" density="med" opacity={0.05} />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-8 z-0 opacity-50"
        >
          <SplatterAccent
            preset="atomic-red"
            variant={0}
            size={240}
            rotate={20}
          />
        </div>
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Create · Tournament
            </div>
            <h1 className="mt-1.5 font-display text-[48px] font-black italic leading-[1.05] tracking-tight">
              New Tournament
            </h1>
            <p className="mt-2 max-w-[58ch] text-[14px] text-ink-muted">
              Configure once, run forever. The engine handles brackets,
              byes, and rink fairness.
            </p>
          </div>
          <Link
            href="/manage/tournaments"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
            Cancel
          </Link>
        </div>
      </div>

      {/* Sections card — single shared border with internal dividers. */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {/* Section 01 — Basics */}
        <Section index="01" title="Basics" desc="Identity, dates, and the format your players will compete in.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <Field
              label="Tournament name"
              required
              error={fieldErrors.name?.[0]}
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Demo Singles Open 2026"
                className={inputClass}
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

          <Field label="Format" required error={fieldErrors.format?.[0]}>
            <FormatPicker
              value={(format || "singles") as TournamentFormat}
              onChange={(f) => setFormat(f)}
            />
            {!format && (
              <span className="text-[11px] text-ink-subtle">
                Pick a format to auto-fill the rules below.
              </span>
            )}
          </Field>

          <Field label="Structure" required error={fieldErrors.structure?.[0]}>
            <StructurePicker
              value={(structure || "knockout") as Structure}
              onChange={(s) => setStructure(s)}
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
                value={formatDefaults?.bowlsPerPlayer ?? ""}
                placeholder="—"
                disabled
                className={cn(inputClass, "tabular-nums")}
              />
            </Field>
            <Field label="Scoring model">
              <select
                value={formatDefaults?.scoringModel ?? "shots_up"}
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
                  formatDefaults?.scoringModel === "shots_up"
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
                  formatDefaults?.scoringModel === "fixed_ends"
                    ? formatDefaults.endsTarget
                    : ""
                }
                placeholder="—"
                disabled
                className={cn(inputClass, "tabular-nums")}
              />
            </Field>
          </div>

          {/* Handicap card — chips + explainer. */}
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
              weaker players a starting-shot advantage applied via{" "}
              <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[11px]">
                home_handicap_start
              </code>{" "}
              /{" "}
              <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[11px]">
                away_handicap_start
              </code>
              . Club-internal only — not endorsed by BSA.
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
                  No active greens for this club. Add some on /manage/greens
                  before seeding round-1 matches.
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
                charged through HandiBowls in v1. See{" "}
                <Link
                  href="/payments"
                  className="text-primary-500 underline-offset-2 hover:underline"
                >
                  /payments
                </Link>{" "}
                for future options.
              </p>
            </div>
          </div>
        </Section>

        {/* Footer — server error / status helper / actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-7 py-5">
          <div className="flex-1 text-[12px] text-ink-subtle">
            {serverError ? (
              <span className="text-danger-500">{serverError}</span>
            ) : valid ? (
              <span className="inline-flex items-center gap-1.5 text-success-500">
                <Check className="size-3.5" aria-hidden="true" />
                Required fields complete — ready to create
              </span>
            ) : (
              <span>
                Fill required fields (name, format, structure) to continue.
              </span>
            )}
          </div>
          <Link
            href="/manage/tournaments"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!valid || pending}
            className={cn(
              "inline-flex h-14 items-center gap-2 rounded-lg bg-primary-500 px-6 text-base font-semibold text-[color:var(--color-on-primary)] shadow-sm transition-colors hover:bg-primary-600",
              (!valid || pending) && "cursor-not-allowed opacity-60",
            )}
          >
            <Sparkles className="size-4" aria-hidden="true" />
            {pending ? "Creating…" : "Create tournament"}
          </button>
        </div>
      </div>
    </form>
  );
}

// -------------------- shared helpers --------------------

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-surface px-3 text-[14px] text-ink placeholder:text-ink-subtle focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-60";

function Section({
  index,
  title,
  desc,
  children,
}: {
  index: string;
  title: React.ReactNode;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 border-b border-border px-7 py-6 last:border-b-0">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          Section {index}
        </span>
        <h2 className="font-display text-2xl font-black tracking-tight">
          {title}
        </h2>
        <p className="text-[13px] text-ink-muted">{desc}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  helper,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        {label}
        {required && <span className="ml-0.5 text-danger-500">*</span>}
      </span>
      {children}
      {helper && !error && (
        <span className="text-[11px] italic text-ink-subtle">{helper}</span>
      )}
      {error && (
        <span className="text-[11px] text-danger-500">{error}</span>
      )}
    </label>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Chip({
  active,
  locked,
  title,
  onClick,
  children,
}: {
  active: boolean;
  locked?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-active={active}
      data-locked={locked}
      title={title}
      disabled={locked}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
        active
          ? "border-primary-500 bg-primary-500 text-[color:var(--color-on-primary)]"
          : "border-border bg-surface text-ink-muted hover:border-ink-subtle hover:text-ink",
        locked && "cursor-not-allowed opacity-55 hover:border-border hover:text-ink-muted",
      )}
    >
      {children}
    </button>
  );
}
