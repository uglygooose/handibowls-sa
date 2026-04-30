"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { formatDateZA } from "@/lib/format/dates";
import { cn } from "@/lib/utils";

import type {
  MemberOption,
  TournamentOption,
} from "../_data";

// Phase 11 / 11-3c — full audience picker.
//
// Replaces the placeholder all_members-only picker from 11-3b with
// the three production audience modes:
//
//   all_members         no further input — pulls every active
//                       member of the club at fan-out time
//   tournament_entrants tournament dropdown sourced from the
//                       club's tournaments. Resolves to the same
//                       UNION the send_message RPC uses (entries
//                       singletons + team_members joined via
//                       tournament_teams)
//   custom              searchable multi-select against the
//                       club's active members. Selected count
//                       surfaces inline so the admin sees what
//                       they're targeting before submit
//
// The component is presentational + state-managed — it owns the
// audience UI but emits state changes upward via onChange so the
// ComposeForm can keep its single source of truth + carry the
// values through useActionState's FormData. Supports a Zod-shaped
// audience input via three controlled props
// (audience_kind, audience_tournament_id, audience_profile_ids).

export type AudiencePickerValue = {
  audience_kind: "all_members" | "tournament_entrants" | "custom";
  audience_tournament_id: string | null;
  audience_profile_ids: string[];
};

type Props = {
  value: AudiencePickerValue;
  onChange: (next: AudiencePickerValue) => void;
  tournaments: TournamentOption[];
  members: MemberOption[];
};

export function AudiencePicker({
  value,
  onChange,
  tournaments,
  members,
}: Props) {
  const setKind = (
    kind: AudiencePickerValue["audience_kind"],
  ) => onChange({ ...value, audience_kind: kind });

  const setTournament = (id: string | null) =>
    onChange({ ...value, audience_tournament_id: id });

  const toggleMember = (profile_id: string) => {
    const next = new Set(value.audience_profile_ids);
    if (next.has(profile_id)) next.delete(profile_id);
    else next.add(profile_id);
    onChange({ ...value, audience_profile_ids: Array.from(next) });
  };

  const clearMembers = () =>
    onChange({ ...value, audience_profile_ids: [] });

  return (
    <div data-slot="audience-picker" className="flex flex-col gap-3">
      {/* Mode radios */}
      <div data-slot="audience-radios" className="flex flex-col gap-2">
        <AudienceRadio
          value="all_members"
          current={value.audience_kind}
          onChange={setKind}
          label="All members"
          sub="Every active member of this club."
        />
        <AudienceRadio
          value="tournament_entrants"
          current={value.audience_kind}
          onChange={setKind}
          label="Tournament entrants"
          sub="Players entered in a specific tournament — singles + team-members combined, withdrawn excluded."
        />
        <AudienceRadio
          value="custom"
          current={value.audience_kind}
          onChange={setKind}
          label="Custom selection"
          sub="Pick a subset of members. Non-members in the list are silently filtered server-side."
        />
      </div>

      {/* Tournament dropdown — only when tournament_entrants is active */}
      {value.audience_kind === "tournament_entrants" && (
        <TournamentSelect
          tournaments={tournaments}
          selectedId={value.audience_tournament_id}
          onSelect={setTournament}
        />
      )}

      {/* Custom multi-select — only when custom is active */}
      {value.audience_kind === "custom" && (
        <CustomMemberPicker
          members={members}
          selectedIds={value.audience_profile_ids}
          onToggle={toggleMember}
          onClearAll={clearMembers}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Radios
// ---------------------------------------------------------------------

function AudienceRadio({
  value,
  current,
  onChange,
  label,
  sub,
}: {
  value: AudiencePickerValue["audience_kind"];
  current: AudiencePickerValue["audience_kind"];
  onChange: (v: AudiencePickerValue["audience_kind"]) => void;
  label: string;
  sub: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      data-slot="audience-radio"
      data-value={value}
      data-active={active}
      data-disabled={false}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
        active
          ? "border-ink bg-ink/4 ring-2 ring-ink/10"
          : "border-border bg-bone hover:border-ink/40",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          active ? "border-ink bg-ink" : "border-border bg-bone",
        )}
      >
        {active && <span className="size-2 rounded-full bg-bone" />}
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[15px] font-bold tracking-tight">
          {label}
        </span>
        <span className="block text-[12.5px] text-ink-muted">{sub}</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------
// Tournament dropdown
// ---------------------------------------------------------------------

function TournamentSelect({
  tournaments,
  selectedId,
  onSelect,
}: {
  tournaments: TournamentOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (tournaments.length === 0) {
    return (
      <div
        data-slot="tournament-select-empty"
        className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-3 text-[12.5px] text-ink-muted"
      >
        No tournaments at this club yet. Create one in /manage/tournaments
        before targeting tournament entrants.
      </div>
    );
  }
  return (
    <div data-slot="tournament-select-row">
      <label
        htmlFor="audience-tournament"
        className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle"
      >
        Tournament
      </label>
      <select
        id="audience-tournament"
        name="audience_tournament_id"
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
        data-slot="tournament-select"
        className={cn(
          "h-11 w-full max-w-xl rounded-lg border border-border bg-bone px-3 text-[14px]",
          "focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10",
        )}
      >
        <option value="">— select a tournament —</option>
        {tournaments.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} · {t.format} · {t.starts_at ? formatDateZA(t.starts_at) : "TBD"}{" "}
            ({t.status})
          </option>
        ))}
      </select>
      {!selectedId && (
        <p
          data-slot="tournament-select-hint"
          className="mt-1 font-mono text-[11px] text-warning-500"
        >
          Pick a tournament to target its entrants.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Custom multi-select
// ---------------------------------------------------------------------

function CustomMemberPicker({
  members,
  selectedIds,
  onToggle,
  onClearAll,
}: {
  members: MemberOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClearAll: () => void;
}) {
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = (m.name ?? "").toLowerCase();
      const email = (m.email ?? "").toLowerCase();
      const bsa = (m.bsa_number ?? "").toLowerCase();
      return name.includes(q) || email.includes(q) || bsa.includes(q);
    });
  }, [members, search]);

  if (members.length === 0) {
    return (
      <div
        data-slot="custom-picker-empty"
        className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-3 text-[12.5px] text-ink-muted"
      >
        No active members at this club yet. Invite members in /manage/members
        before targeting a custom selection.
      </div>
    );
  }

  return (
    <div data-slot="custom-picker" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor="custom-search"
          className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle"
        >
          Members ({selectedSet.size}{" "}
          {selectedSet.size === 1 ? "selected" : "selected"})
        </label>
        {selectedSet.size > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            data-slot="custom-clear-all"
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 font-mono text-[10.5px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <X className="size-3" aria-hidden="true" />
            Clear all
          </button>
        )}
      </div>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        />
        <input
          id="custom-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or BSA #…"
          data-slot="custom-picker-search"
          className={cn(
            "h-11 w-full rounded-lg border border-border bg-bone pl-10 pr-3.5 text-[14px]",
            "placeholder:text-ink-muted",
            "focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10",
          )}
        />
      </div>
      <ul
        data-slot="custom-picker-rows"
        className="max-h-[420px] divide-y divide-border overflow-y-auto rounded-lg border border-border bg-bone"
      >
        {filtered.length === 0 ? (
          <li className="px-3.5 py-3 text-[13px] text-ink-muted">
            No matches.
          </li>
        ) : (
          filtered.map((m) => {
            const checked = selectedSet.has(m.profile_id);
            return (
              <li key={m.profile_id}>
                <button
                  type="button"
                  onClick={() => onToggle(m.profile_id)}
                  data-slot="custom-picker-row"
                  data-profile-id={m.profile_id}
                  data-checked={checked}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left transition-colors",
                    checked ? "bg-primary-500/8" : "hover:bg-surface-muted",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border-2",
                      checked ? "border-ink bg-ink" : "border-border bg-bone",
                    )}
                  >
                    {checked && (
                      <svg
                        viewBox="0 0 16 16"
                        className="size-3 text-bone"
                        aria-hidden="true"
                      >
                        <path
                          d="M3 8.5l3 3 7-7"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold">
                      {m.name ?? "Unnamed"}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-ink-muted">
                      {m.bsa_number ?? "no BSA #"}
                      {m.email ? ` · ${m.email}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
      {selectedSet.size === 0 && (
        <p
          data-slot="custom-picker-hint"
          className="font-mono text-[11px] text-warning-500"
        >
          Tap rows to add them to the audience.
        </p>
      )}
    </div>
  );
}
