"use client";

import {
  AlertTriangle,
  ChevronRight,
  Code2,
  Download,
  FileText,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { RubricDiff } from "@/components/t20/RubricDiff";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDateZA } from "@/lib/format/dates";
import { diffRubrics, summariseDiff } from "@/lib/t20/diff";
import { RubricSchema } from "@/lib/t20/rubric";

import {
  activateRubricVersion,
  deactivateRubricVersion,
  uploadRubricVersion,
} from "../_actions";
import type { RubricVersionRow } from "../_data";
import { RubricSchemaDialog } from "./RubricSchemaDialog";

// Phase 10 / 10-8 — Twenty 20 rubric library, super-admin surface.
//
// One Client island composing:
//   • Hero with status pills (active / draft pending / captures-locked)
//   • UploadZone (drag-drop or click)
//   • DraftBanner when at least one draft exists
//   • VersionsTable
//   • PendingChangesPanel — permanent inline diff (active vs first draft)
//   • DiffModal + ActivateModal + DeactivateModal (lazy-rendered)
//
// All three actions ship from 10-2: uploadRubricVersion,
// activateRubricVersion, deactivateRubricVersion. The Client form
// reads + validates the JSON file client-side before posting; the
// action re-validates as the authoritative gate.
//
// Activation is presented as one-way: the modal headline emphasises
// the gravity per the brief ("Rubric upload is a destructive
// operation if done wrong"). Existing assessments retain their pinned
// rubric_version_id forever — the FK is on_delete restrict.

type Props = {
  rows: RubricVersionRow[];
};

type DialogMode =
  | { kind: "none" }
  | { kind: "diff"; targetId: string }
  | { kind: "activate"; targetId: string }
  | { kind: "deactivate"; targetId: string };

export function RubricsClient({ rows }: Props) {
  const [dialog, setDialog] = useState<DialogMode>({ kind: "none" });
  const [selectedId, setSelectedId] = useState<string>(
    rows.find((r) => r.isActive)?.id ?? rows[0]?.id ?? "",
  );
  // Phase 12.5 / 12.5-3 (audit `rubrics-view-schema-modal`): id of
  // the rubric whose schema is currently being inspected. null → no
  // dialog open.
  const [schemaInspectId, setSchemaInspectId] = useState<string | null>(null);
  const schemaInspectRow = useMemo(
    () => (schemaInspectId ? rows.find((r) => r.id === schemaInspectId) ?? null : null),
    [schemaInspectId, rows],
  );

  const active = useMemo(() => rows.find((r) => r.status === "active"), [rows]);
  const drafts = useMemo(
    () => rows.filter((r) => r.status === "draft"),
    [rows],
  );
  const firstDraft = drafts[0];
  const lockedToActiveCount = active?.assessmentCount ?? 0;

  // Diff active → first draft for the permanent inline panel + diff
  // modal. Compute once per render; both rubrics may be null if a
  // version's persisted JSON failed the schema parse server-side.
  const pendingDiff = useMemo(() => {
    if (!active?.rubric || !firstDraft?.rubric) return [];
    return diffRubrics(active.rubric, firstDraft.rubric);
  }, [active, firstDraft]);
  const pendingDiffSummary = summariseDiff(pendingDiff);

  return (
    <div
      data-slot="rubrics-page"
      className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 pb-24"
    >
      <AdminPageHero
        eyebrow="Platform · Rubric library"
        title="Twenty 20 rubrics"
        description="Version-controlled scoring rules. One active rubric at a time. Upload, diff, activate — captures lock to whichever rubric was active at the moment they began."
        speckle={{ seed: "rubric-hero", density: "high", opacity: 0.07 }}
        splatter={{ preset: "ocean-green", variant: 2, size: "L", rotate: -22, opacity: 0.5, top: -56, right: -12 }}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-slot="active-pill"
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary-500 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-on-primary"
            >
              <FileText className="size-3" aria-hidden="true" />
              {active ? `${active.version} · ACTIVE` : "No active rubric"}
            </span>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-bone px-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              {lockedToActiveCount} captures locked to active
            </span>
            {drafts.length > 0 && (
              <span
                data-slot="drafts-pending-pill"
                className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em]"
                style={{
                  background: "#fef3c7",
                  borderColor: "#facc15",
                  borderWidth: 1,
                  color: "#854d0e",
                }}
              >
                <AlertTriangle className="size-3" aria-hidden="true" />
                {drafts.length} draft{drafts.length === 1 ? "" : "s"} pending
              </span>
            )}
          </div>
        }
        containerWidth="none"
      />

      <UploadZone onUploaded={() => undefined} />

      {firstDraft && active && (
        <DraftBanner
          draft={firstDraft}
          onCompare={() =>
            setDialog({ kind: "diff", targetId: firstDraft.id })
          }
          onActivate={() =>
            setDialog({ kind: "activate", targetId: firstDraft.id })
          }
        />
      )}

      <VersionsTable
        rows={rows}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onActivate={(id) => setDialog({ kind: "activate", targetId: id })}
        onDeactivate={(id) =>
          setDialog({ kind: "deactivate", targetId: id })
        }
        onViewSchema={(id) => setSchemaInspectId(id)}
        canDeactivate={(id) => canDeactivate(rows, id)}
      />

      {schemaInspectRow?.rubric && (
        <RubricSchemaDialog
          open
          onOpenChange={(o) => {
            if (!o) setSchemaInspectId(null);
          }}
          rubric={schemaInspectRow.rubric}
          versionLabel={schemaInspectRow.version}
        />
      )}

      {active && firstDraft && (
        <PendingChangesPanel
          activeLabel={`${active.version} · ACTIVE`}
          incomingLabel={`${firstDraft.version} · INCOMING`}
          changes={pendingDiff}
          summary={pendingDiffSummary}
        />
      )}

      {dialog.kind === "diff" && (
        <DiffModal
          changes={pendingDiff}
          activeLabel={active ? `${active.version} · ACTIVE` : "—"}
          incomingLabel={
            rows.find((r) => r.id === dialog.targetId)?.version ?? "—"
          }
          onClose={() => setDialog({ kind: "none" })}
          onActivate={() =>
            setDialog({ kind: "activate", targetId: dialog.targetId })
          }
        />
      )}
      {dialog.kind === "activate" && (
        <ActivateModal
          target={rows.find((r) => r.id === dialog.targetId) ?? null}
          active={active ?? null}
          lockedCount={lockedToActiveCount}
          onClose={() => setDialog({ kind: "none" })}
        />
      )}
      {dialog.kind === "deactivate" && (
        <DeactivateModal
          target={rows.find((r) => r.id === dialog.targetId) ?? null}
          onClose={() => setDialog({ kind: "none" })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Upload zone
// ---------------------------------------------------------------------

function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  void onUploaded;
  const [hover, setHover] = useState(false);
  const [pending, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function pickFile() {
    fileInputRef.current?.click();
  }

  async function readFile(file: File): Promise<unknown> {
    const text = await file.text();
    return JSON.parse(text);
  }

  function handleSelectedFile(file: File) {
    setError(null);
    startUpload(async () => {
      let json: unknown;
      try {
        json = await readFile(file);
      } catch {
        setError("That file isn't valid JSON.");
        return;
      }
      const parsed = RubricSchema.safeParse(json);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        setError(
          `Schema validation failed: ${first?.message ?? "Invalid rubric shape."}`,
        );
        return;
      }
      const result = await uploadRubricVersion({
        version: parsed.data.version,
        rubric: parsed.data,
      });
      if (result.kind === "ok") {
        toast.success(`Uploaded ${parsed.data.version} as a draft.`);
        onUploaded();
        return;
      }
      if (result.kind === "duplicate_version") {
        setError(
          `Version "${parsed.data.version}" already exists. Bump the version field.`,
        );
        return;
      }
      if (result.kind === "schema_invalid" || result.kind === "validation") {
        setError(result.error);
        return;
      }
      if (result.kind === "auth") {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setError("Upload failed unexpectedly.");
    });
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    handleSelectedFile(file);
    // Reset the input so the same file can be re-selected if validation fails.
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setHover(false);
    const file = e.dataTransfer.files[0];
    if (file) handleSelectedFile(file);
  }

  return (
    <section
      data-slot="upload-zone"
      data-hover={hover}
      data-pending={pending}
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
      className={cn(
        "rounded-2xl border-2 border-dashed transition",
        hover
          ? "border-primary-500 bg-primary-500/4"
          : "border-border-strong bg-surface-muted",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-[54px] items-center justify-center rounded-[14px] transition",
              hover
                ? "bg-primary-500 text-on-primary"
                : "bg-ink text-ink-inverse",
            )}
          >
            <Upload className="size-5" />
          </span>
          <div>
            <h4 className="font-display text-[18px] font-extrabold tracking-tight">
              Upload new rubric version
            </h4>
            <p className="text-[13px] text-ink-muted">
              JSON validated against the v1 schema before staging as a draft.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onChange}
            data-slot="upload-input"
            className="sr-only"
          />
          <button
            type="button"
            onClick={pickFile}
            disabled={pending}
            data-slot="upload-cta"
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-md bg-primary-500 px-4 text-[13px] font-semibold text-on-primary shadow-sm",
              "hover:bg-primary-600",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Upload className="size-4" aria-hidden="true" />
            {pending ? "Uploading…" : "Upload file"}
          </button>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          data-slot="upload-error"
          className="border-t border-danger-500/30 bg-danger-500/8 px-6 py-3 text-[13px] text-ink"
        >
          {error}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// Draft banner
// ---------------------------------------------------------------------

function DraftBanner({
  draft,
  onCompare,
  onActivate,
}: {
  draft: RubricVersionRow;
  onCompare: () => void;
  onActivate: () => void;
}) {
  return (
    <section
      data-slot="draft-banner"
      data-draft-id={draft.id}
      className="overflow-hidden rounded-2xl border-2"
      style={{ borderColor: "var(--color-warning-500)" }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5"
        style={{
          background: "#fef3c7",
          borderBottom: "1px solid #facc15",
        }}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-lg"
            style={{
              background: "var(--color-warning-500)",
              color: "#0a0a0a",
            }}
          >
            <AlertTriangle className="size-4" />
          </span>
          <div style={{ color: "#854d0e" }}>
            <div className="text-[14px] font-bold">
              {draft.version} draft awaiting activation
            </div>
            <div className="text-[12px] opacity-85">
              Uploaded by {draft.createdByName ?? "Unknown"} ·{" "}
              {formatDateZA(draft.createdAt)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCompare}
            data-slot="draft-compare-cta"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-bone px-3.5 text-[13px] font-medium text-ink hover:bg-surface-muted"
          >
            <FileText className="size-4" aria-hidden="true" />
            Compare changes
          </button>
          <button
            type="button"
            onClick={onActivate}
            data-slot="draft-activate-cta"
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[13px] font-semibold text-ink-inverse hover:opacity-90"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Activate {draft.version}
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Versions table
// ---------------------------------------------------------------------

function VersionsTable({
  rows,
  selectedId,
  onSelect,
  onActivate,
  onDeactivate,
  onViewSchema,
  canDeactivate,
}: {
  rows: RubricVersionRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
  onViewSchema: (id: string) => void;
  canDeactivate: (id: string) => boolean;
}) {
  return (
    <section
      data-slot="versions-table"
      className="overflow-hidden rounded-2xl border border-border bg-bone"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            All versions
          </div>
          <h3 className="mt-0.5 font-display text-[20px] font-extrabold tracking-tight">
            Rubric history
          </h3>
        </div>
        <button
          type="button"
          disabled
          title="Changelog export ships with the PDF template follow-up"
          data-slot="export-changelog-cta"
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium text-ink-muted opacity-60"
        >
          <Download className="size-3.5" aria-hidden="true" />
          Export changelog
        </button>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-surface-muted/50">
              <Th>Version</Th>
              <Th>Status</Th>
              <Th>Uploaded</Th>
              <Th align="right">Captures locked</Th>
              <Th>Notes</Th>
              <Th align="right">{""}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-[13px] text-ink-muted"
                >
                  No rubric versions yet. Upload one above.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  data-slot="version-row"
                  data-version-id={r.id}
                  data-status={r.status}
                  data-selected={r.id === selectedId}
                  onClick={() => onSelect(r.id)}
                  className={cn(
                    "cursor-pointer border-b border-border/60 transition last:border-b-0",
                    r.id === selectedId
                      ? "bg-surface-muted"
                      : "hover:bg-surface-muted/40",
                  )}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-1.5 rounded-full",
                          r.id === selectedId ? "bg-primary-500" : "bg-transparent",
                        )}
                      />
                      <span className="font-mono text-[13.5px] font-bold">
                        {r.version}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-[13px] font-medium">
                      {r.createdByName ?? "Unknown"}
                    </div>
                    <div className="font-mono text-[11px] text-ink-muted">
                      {formatDateZA(r.createdAt)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {r.assessmentCount}
                  </td>
                  <td
                    className="px-3 py-3 text-[12px] text-ink-muted"
                    style={{ maxWidth: 340 }}
                  >
                    {r.rubric
                      ? `v${r.rubric.version} · ${r.rubric.rounds} rounds · ${r.rubric.deliveriesPerRoundPerDistance} per-distance`
                      : "Schema parse failed — contact platform admin."}
                  </td>
                  <td
                    className="whitespace-nowrap px-3 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.rubric && (
                      <button
                        type="button"
                        onClick={() => onViewSchema(r.id)}
                        data-slot="row-view-schema-cta"
                        title={`View ${r.version} section structure + JSON`}
                        className="mr-1.5 inline-flex h-8 items-center gap-1 rounded-md border border-border bg-bone px-2.5 text-[12px] font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
                      >
                        <Code2 className="size-3.5" aria-hidden="true" />
                        View schema
                      </button>
                    )}
                    {r.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => onActivate(r.id)}
                        data-slot="row-activate-cta"
                        className="inline-flex h-8 items-center rounded-md border border-border bg-bone px-2.5 text-[12px] font-medium text-ink hover:bg-surface-muted"
                      >
                        Review
                        <ChevronRight
                          className="ml-1 size-3.5"
                          aria-hidden="true"
                        />
                      </button>
                    )}
                    {r.status === "active" && canDeactivate(r.id) && (
                      <button
                        type="button"
                        onClick={() => onDeactivate(r.id)}
                        data-slot="row-deactivate-cta"
                        className="inline-flex h-8 items-center rounded-md border border-border bg-bone px-2.5 text-[12px] font-medium text-ink hover:bg-danger-500/8"
                      >
                        Deactivate
                      </button>
                    )}
                    {r.status === "active" && !canDeactivate(r.id) && (
                      <span
                        title="The active rubric is the only one. Activate a draft first."
                        className="inline-flex h-8 items-center rounded-md px-2.5 text-[12px] text-ink-subtle"
                      >
                        Active
                      </span>
                    )}
                    {r.status === "archived" && (
                      <span className="inline-flex h-8 items-center rounded-md px-2.5 text-[12px] text-ink-muted">
                        Locked
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}

function StatusPill({
  status,
}: {
  status: "active" | "draft" | "archived";
}) {
  const map = {
    active: {
      bg: "var(--color-primary-500)",
      fg: "var(--color-on-primary)",
      label: "ACTIVE",
    },
    draft: {
      bg: "var(--color-warning-500)",
      fg: "#0a0a0a",
      label: "DRAFT",
    },
    archived: {
      bg: "var(--color-ink)",
      fg: "var(--color-ink-inverse)",
      label: "ARCHIVED",
    },
  }[status];
  return (
    <span
      data-slot="status-pill"
      data-status={status}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-display text-[11px] font-black uppercase tracking-[0.16em]"
      style={{ background: map.bg, color: map.fg }}
    >
      {status === "active" && (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full"
          style={{ background: map.fg }}
        />
      )}
      {map.label}
    </span>
  );
}

// ---------------------------------------------------------------------
// Pending changes panel (permanent inline)
// ---------------------------------------------------------------------

function PendingChangesPanel({
  activeLabel,
  incomingLabel,
  changes,
  summary,
}: {
  activeLabel: string;
  incomingLabel: string;
  changes: ReturnType<typeof diffRubrics>;
  summary: ReturnType<typeof summariseDiff>;
}) {
  return (
    <section
      data-slot="pending-changes-panel"
      className="rounded-2xl border border-border bg-bone px-6 py-5"
    >
      <header className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            Pending changes
          </div>
          <h3 className="mt-0.5 font-display text-[20px] font-extrabold tracking-tight">
            {activeLabel.split(" · ")[0]} → {incomingLabel.split(" · ")[0]}
          </h3>
        </div>
        <span
          data-slot="pending-changes-summary"
          className="font-mono text-[12px] text-ink-muted"
        >
          {summary.total} change{summary.total === 1 ? "" : "s"} ·{" "}
          {summary.added} added · {summary.removed} removed ·{" "}
          {summary.changed} changed
        </span>
      </header>
      <RubricDiff
        changes={changes}
        leftLabel={activeLabel}
        rightLabel={incomingLabel}
      />
    </section>
  );
}

// ---------------------------------------------------------------------
// Diff modal
// ---------------------------------------------------------------------

function DiffModal({
  changes,
  activeLabel,
  incomingLabel,
  onClose,
  onActivate,
}: {
  changes: ReturnType<typeof diffRubrics>;
  activeLabel: string;
  incomingLabel: string;
  onClose: () => void;
  onActivate: () => void;
}) {
  // Phase 13 / 13-1 / commit 8b — was a manual `role="dialog"` div with
  // overlay onClick + stopPropagation + manual close button. Replaced with
  // shadcn Dialog (Radix Dialog under the hood) for proper focus trap +
  // aria-modal + aria-labelledby + ESC handling. The DialogContent ships
  // its own close button (X icon, top-right) so the manual one is dropped.
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        data-slot="diff-modal"
        className="flex max-h-[85vh] w-full max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl bg-bone p-0 sm:max-w-5xl"
      >
        <DialogHeader className="flex-row items-start justify-between gap-3 border-b border-border px-7 py-5">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Side-by-side diff
            </div>
            <DialogTitle className="mt-1 font-display text-[24px] font-black italic leading-tight tracking-tight">
              {activeLabel.split(" · ")[0]} → {incomingLabel.split(" · ")[0]}
            </DialogTitle>
            <DialogDescription className="mt-1 max-w-[58ch] text-[12px] text-ink-muted">
              Activating will lock all <strong>new</strong> captures to its
              rules. Existing assessments retain their original rubric
              forever.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="overflow-auto px-7 py-5">
          <RubricDiff
            changes={changes}
            leftLabel={activeLabel}
            rightLabel={incomingLabel}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted px-7 py-4">
          <p className="text-[12px] text-ink-muted">
            <strong>Note:</strong> Activation cannot be undone — only
            superseded by a newer version.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-md px-3 text-[13px] font-medium text-ink hover:bg-bone"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onActivate}
              data-slot="diff-modal-activate-cta"
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[13px] font-semibold text-ink-inverse hover:opacity-90"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              Activate {incomingLabel.split(" · ")[0]}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Activate modal
// ---------------------------------------------------------------------

function ActivateModal({
  target,
  active,
  lockedCount,
  onClose,
}: {
  target: RubricVersionRow | null;
  active: RubricVersionRow | null;
  lockedCount: number;
  onClose: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, startActivation] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!target) return null;

  function onConfirm() {
    if (!target) return;
    setError(null);
    startActivation(async () => {
      const result = await activateRubricVersion({ rubric_id: target.id });
      if (result.kind === "ok") {
        toast.success(`Activated ${target.version}.`);
        onClose();
        return;
      }
      if (result.kind === "already_active") {
        setError("That rubric is already active.");
        return;
      }
      if (result.kind === "not_found") {
        setError("Rubric version not found.");
        return;
      }
      if (result.kind === "auth" || result.kind === "validation") {
        setError(result.error);
        return;
      }
      setError(result.error || "Activation failed.");
    });
  }

  // Phase 13 / 13-1 / commit 8b — manual modal → shadcn Dialog. See
  // DiffModal above for the rationale; same swap pattern.
  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onClose(); }}>
      <DialogContent
        data-slot="activate-modal"
        data-target-id={target.id}
        className="w-full max-w-[560px] gap-0 overflow-hidden rounded-2xl bg-bone p-0 sm:max-w-[560px]"
      >
        <DialogHeader className="px-7 pb-2 pt-7">
          <span
            aria-hidden="true"
            className="mb-4 flex size-[54px] items-center justify-center rounded-[14px]"
            style={{
              background: "var(--color-warning-500)",
              color: "#0a0a0a",
            }}
          >
            <AlertTriangle className="size-5" />
          </span>
          <DialogTitle className="mb-2 font-display text-[24px] font-black italic leading-tight tracking-tight">
            Activate {target.version}?
          </DialogTitle>
          <DialogDescription className="mb-3.5 text-[14px] leading-[1.55] text-ink-muted">
            This becomes the active rubric across all clubs immediately. Captures
            already in progress are not affected — they keep{" "}
            <strong className="text-ink">{active?.version ?? "—"}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="px-7 pb-2">
          <div className="rounded-[14px] border border-border bg-surface-muted p-4">
            <Stat label="Captures locked to active" value={lockedCount} />
            <Stat label="Drafts pending review" value={1} />
            <Stat
              label="Network impact"
              value="all clubs immediately"
              valueClass="font-mono text-[12px] tabular-nums"
            />
          </div>
          <label
            data-slot="activate-acknowledge"
            className="mt-3.5 flex cursor-pointer items-center gap-2.5 text-[13.5px]"
          >
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              data-slot="activate-acknowledge-input"
              className="size-[18px] cursor-pointer"
            />
            <span>
              I understand this cannot be reverted, only superseded.
            </span>
          </label>
          {error && (
            <p
              role="alert"
              data-slot="activate-error"
              className="mt-2.5 text-[13px] text-danger-500"
            >
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-surface-muted px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            data-slot="activate-cancel-cta"
            className="inline-flex h-10 items-center rounded-md px-3 text-[13px] font-medium text-ink hover:bg-bone"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!acknowledged || pending}
            data-slot="activate-confirm-cta"
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-md bg-primary-500 px-3.5 text-[13px] font-semibold text-on-primary shadow-sm",
              "hover:bg-primary-600",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Sparkles className="size-4" aria-hidden="true" />
            {pending ? "Activating…" : "Activate now"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-[13px] [&+&]:mt-1.5">
      <span className="text-ink-muted">{label}</span>
      <span
        className={cn(
          "font-mono font-bold tabular-nums",
          valueClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------
// Deactivate modal
// ---------------------------------------------------------------------

function DeactivateModal({
  target,
  onClose,
}: {
  target: RubricVersionRow | null;
  onClose: () => void;
}) {
  const [pending, startDeactivation] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!target) return null;

  function onConfirm() {
    if (!target) return;
    setError(null);
    startDeactivation(async () => {
      const result = await deactivateRubricVersion({ rubric_id: target.id });
      if (result.kind === "ok") {
        toast.success(`Deactivated ${target.version}.`);
        onClose();
        return;
      }
      if (result.kind === "not_active") {
        setError("That rubric isn't currently active.");
        return;
      }
      if (result.kind === "not_found") {
        setError("Rubric version not found.");
        return;
      }
      if (result.kind === "auth" || result.kind === "validation") {
        setError(result.error);
        return;
      }
      setError(result.error || "Deactivation failed.");
    });
  }

  // Phase 13 / 13-1 / commit 8b — manual modal → shadcn Dialog.
  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onClose(); }}>
      <DialogContent
        data-slot="deactivate-modal"
        className="w-full max-w-[520px] gap-0 overflow-hidden rounded-2xl bg-bone p-0 sm:max-w-[520px]"
      >
        <DialogHeader className="px-7 pb-3 pt-7">
          <span
            aria-hidden="true"
            className="mb-4 flex size-[54px] items-center justify-center rounded-[14px] bg-danger-500/15 text-danger-500"
          >
            <X className="size-5" />
          </span>
          <DialogTitle className="mb-2 font-display text-[22px] font-black italic leading-tight tracking-tight">
            Deactivate {target.version}?
          </DialogTitle>
          <DialogDescription className="text-[13.5px] leading-[1.55] text-ink-muted">
            New captures cannot begin until another rubric is activated. This
            is rare — usually you activate a replacement first, which auto-
            deactivates the current one.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="px-7">
            <p
              role="alert"
              data-slot="deactivate-error"
              className="mt-2.5 text-[13px] text-danger-500"
            >
              {error}
            </p>
          </div>
        )}
        <div className="mt-3 flex justify-end gap-2 border-t border-border bg-surface-muted px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            data-slot="deactivate-cancel-cta"
            className="inline-flex h-10 items-center rounded-md px-3 text-[13px] font-medium text-ink hover:bg-bone"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            data-slot="deactivate-confirm-cta"
            className={cn(
              "inline-flex h-10 items-center rounded-md bg-danger-500 px-3.5 text-[13px] font-semibold text-bone shadow-sm",
              "hover:opacity-90",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {pending ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/** Defensive UI gate per brief: "can't deactivate the only active rubric".
 *  Allow deactivation only when at least one other version exists that
 *  could carry the work going forward (typically a draft or an archived
 *  predecessor). The action layer doesn't enforce this — it's a UX
 *  guardrail to prevent the system from reaching a "no active rubric"
 *  state in a single click. */
function canDeactivate(rows: RubricVersionRow[], targetId: string): boolean {
  const target = rows.find((r) => r.id === targetId);
  if (!target?.isActive) return false;
  return rows.some((r) => r.id !== targetId);
}
