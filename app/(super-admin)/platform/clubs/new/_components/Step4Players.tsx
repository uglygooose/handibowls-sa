"use client";

import { AlertCircle, CheckCircle2, FileUp, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parsePlayerCsv, type CsvParseRow } from "@/lib/csv/parsePlayerCsv";
import { cn } from "@/lib/utils";

import {
  playerSchema,
  type PlayerInput,
  type WizardFormInput,
  type WizardFormValues,
} from "../_schema";

const MAX_PLAYERS = 50;

type CsvRow = CsvParseRow<PlayerInput>;

function parseCsv(text: string): CsvRow[] {
  return parsePlayerCsv<PlayerInput>(
    text,
    (raw) => {
      const candidate = {
        first_name: (raw.first_name ?? "").trim(),
        last_name: (raw.last_name ?? "").trim(),
        email: (raw.email ?? "").trim(),
        is_club_admin: false,
      };
      const check = playerSchema.safeParse(candidate);
      if (check.success) return { ok: true, data: check.data };
      return {
        ok: false,
        errors: check.error.issues.map(
          (iss) => `${iss.path.join(".") || "row"}: ${iss.message}`,
        ),
      };
    },
    MAX_PLAYERS,
  );
}

export function Step4Players() {
  const form = useFormContext<WizardFormInput, unknown, WizardFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "players.players",
  });

  const [draft, setDraft] = useState<PlayerInput>({
    first_name: "",
    last_name: "",
    email: "",
    is_club_admin: false,
  });
  const [draftError, setDraftError] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const remaining = MAX_PLAYERS - fields.length;
  const canAppend = remaining > 0;

  const resetDraft = () =>
    setDraft({ first_name: "", last_name: "", email: "", is_club_admin: false });

  const handleAddDraft = () => {
    setDraftError(null);
    const check = playerSchema.safeParse(draft);
    if (!check.success) {
      const first = check.error.issues[0];
      setDraftError(first?.message ?? "Invalid player");
      return;
    }
    if (!canAppend) {
      setDraftError(`Maximum ${MAX_PLAYERS} players per batch.`);
      return;
    }
    // Prevent duplicate emails across the pending list.
    const lower = check.data.email.toLowerCase();
    if (
      fields.some((f) => f.email.toLowerCase() === lower) ||
      form.getValues("adminInvite.admin_email").toLowerCase() === lower
    ) {
      setDraftError("That email is already in the list (or is the club admin).");
      return;
    }
    append(check.data);
    resetDraft();
  };

  const handleCsvPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError(null);
    setCsvRows(null);
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) {
      setCsvError("CSV must be 1 MB or smaller.");
      event.target.value = "";
      return;
    }
    file.text().then(
      (text) => {
        try {
          const rows = parseCsv(text);
          if (rows.length === 0) setCsvError("CSV has no data rows.");
          setCsvRows(rows);
        } catch (e) {
          setCsvError(e instanceof Error ? e.message : "Could not parse CSV.");
        }
      },
      (e: unknown) => {
        setCsvError(e instanceof Error ? e.message : "Could not read file.");
      },
    );
  };

  const mergeCsv = () => {
    if (!csvRows) return;
    const existing = new Set(fields.map((f) => f.email.toLowerCase()));
    const adminLower = form.getValues("adminInvite.admin_email").toLowerCase();
    if (adminLower) existing.add(adminLower);
    let merged = 0;
    for (const row of csvRows) {
      if (!row.parsed) continue;
      const lower = row.parsed.email.toLowerCase();
      if (existing.has(lower)) continue;
      if (fields.length + merged >= MAX_PLAYERS) break;
      append(row.parsed);
      existing.add(lower);
      merged += 1;
    }
    setCsvRows(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const validCsvCount = csvRows?.filter((r) => r.parsed).length ?? 0;

  return (
    <div data-testid="step-4-players" className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Optional — you can skip this step and invite players after the club is
        live. Up to {MAX_PLAYERS} players per batch.
      </p>

      {/* Single-row form */}
      <div className="rounded-xl border border-border p-4">
        <h3 className="mb-3 font-mono text-[11px] tracking-[0.12em] uppercase text-ink-muted">
          Add one player
        </h3>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.5fr_auto]">
          <div>
            <Label htmlFor="draft-first">First name</Label>
            <Input
              id="draft-first"
              data-testid="draft-first-name"
              value={draft.first_name}
              onChange={(e) => setDraft({ ...draft, first_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="draft-last">Last name</Label>
            <Input
              id="draft-last"
              data-testid="draft-last-name"
              value={draft.last_name}
              onChange={(e) => setDraft({ ...draft, last_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="draft-email">Email</Label>
            <Input
              id="draft-email"
              data-testid="draft-email"
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={handleAddDraft}
              disabled={!canAppend}
              data-testid="draft-add"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Checkbox
            id="draft-admin"
            data-testid="draft-is-admin"
            checked={draft.is_club_admin}
            onCheckedChange={(v) =>
              setDraft({ ...draft, is_club_admin: v === true })
            }
          />
          <Label htmlFor="draft-admin" className="text-sm font-normal">
            Also invite as a club admin
          </Label>
        </div>
        {draftError && (
          <p className="mt-2 text-sm text-destructive" data-testid="draft-error">
            {draftError}
          </p>
        )}
      </div>

      {/* CSV import */}
      <div className="rounded-xl border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-muted">
            Import from CSV
          </h3>
          <span className="text-xs text-ink-subtle">
            Headers: <code>first_name,last_name,email</code>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={csvInputRef}
            type="file"
            accept="text/csv,.csv"
            onChange={handleCsvPick}
            data-testid="csv-file"
            className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-background hover:file:bg-foreground/90"
          />
          <FileUp className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
        </div>
        {csvError && (
          <p className="mt-2 text-sm text-destructive" data-testid="csv-error">
            {csvError}
          </p>
        )}
        {csvRows && csvRows.length > 0 && (
          <div className="mt-4" data-testid="csv-preview">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm">
                <strong>{validCsvCount}</strong> of <strong>{csvRows.length}</strong>{" "}
                rows valid.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCsvRows(null);
                    if (csvInputRef.current) csvInputRef.current.value = "";
                  }}
                  data-testid="csv-cancel"
                >
                  <X className="mr-1 h-3 w-3" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={mergeCsv}
                  disabled={validCsvCount === 0}
                  data-testid="csv-import"
                >
                  Import {validCsvCount} row{validCsvCount === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
            <ul className="max-h-56 overflow-auto rounded-md border border-border text-sm">
              {csvRows.map((row) => (
                <li
                  key={row.index}
                  data-testid={`csv-row-${row.index}`}
                  className={cn(
                    "flex items-start gap-3 border-b border-border px-3 py-2 last:border-b-0",
                    !row.parsed && "bg-destructive/5",
                  )}
                >
                  {row.parsed ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 text-success-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 text-destructive"
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex-1">
                    <div className="font-mono text-xs text-ink-muted">
                      Row {row.index + 1}
                    </div>
                    <div>
                      {row.raw.first_name || "—"} {row.raw.last_name || ""} ·{" "}
                      <span className="text-ink-muted">
                        {row.raw.email || "(no email)"}
                      </span>
                    </div>
                    {row.errors.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-xs text-destructive">
                        {row.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Added players table */}
      {fields.length > 0 && (
        <div className="rounded-xl border border-border" data-testid="players-table">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-muted">
              Players added ({fields.length} / {MAX_PLAYERS})
            </h3>
            <span className="text-xs text-ink-subtle">
              {remaining} slot{remaining === 1 ? "" : "s"} remaining
            </span>
          </div>
          <ul>
            {fields.map((field, index) => (
              <li
                key={field.id}
                data-testid={`player-row-${index}`}
                className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
              >
                <div className="flex-1">
                  <div className="font-medium">
                    {field.first_name} {field.last_name}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {field.email}
                    {field.is_club_admin && (
                      <span className="ml-2 rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-500">
                        admin
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-md"
                  aria-label={`Remove ${field.first_name} ${field.last_name}`}
                  onClick={() => remove(index)}
                  data-testid={`player-${index}-remove`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
