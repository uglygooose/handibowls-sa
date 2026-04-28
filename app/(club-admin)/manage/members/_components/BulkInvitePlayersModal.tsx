"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileUp,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parsePlayerCsv, type CsvParseRow } from "@/lib/csv/parsePlayerCsv";
import { createPlayerInvitesBatch } from "@/lib/invites/actions";
import { cn } from "@/lib/utils";

// Lenient row schema: email is the only required column for an invite.
// First/last are optional (admin can fill in later when prefilling /me/setup
// is desirable, but a bare email-only invite is valid).
const bulkInviteRowSchema = z.object({
  email: z.string().trim().email("Invalid email").max(254),
  first_name: z.string().trim().max(80).optional(),
  last_name: z.string().trim().max(80).optional(),
});
type BulkInviteRow = z.infer<typeof bulkInviteRowSchema>;

type Props = {
  clubId: string;
  // Lowercased emails already known to this club (active members + pending
  // invites). Used to flag client-side duplicates so the user sees the
  // truthful "X new, Y already-known, Z invalid" preview before submit.
  // The DB RPC dedupes again — this is a UX hint, not the authority.
  existingEmails: string[];
};

const MAX_BULK = 100;

type RowClass =
  | "create"
  | "duplicate-in-file"
  | "duplicate-existing"
  | "invalid";

const CLASS_LABEL: Record<RowClass, string> = {
  create: "Will invite",
  "duplicate-in-file": "Skipped (duplicate row)",
  "duplicate-existing": "Skipped (already pending or member)",
  invalid: "Skipped (errors below)",
};

export function BulkInvitePlayersModal({ clubId, existingEmails }: Props) {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const existingSet = useMemo(
    () => new Set(existingEmails.map((e) => e.toLowerCase())),
    [existingEmails],
  );

  const rows = useMemo<CsvParseRow<BulkInviteRow>[]>(() => {
    if (!csvText.trim()) return [];
    return parsePlayerCsv<BulkInviteRow>(
      csvText,
      (raw) => {
        const candidate = {
          email: (raw.email ?? "").trim(),
          first_name: (raw.first_name ?? "").trim() || undefined,
          last_name: (raw.last_name ?? "").trim() || undefined,
        };
        const check = bulkInviteRowSchema.safeParse(candidate);
        if (check.success) return { ok: true, data: check.data };
        return {
          ok: false,
          errors: check.error.issues.map(
            (iss) => `${iss.path.join(".") || "row"}: ${iss.message}`,
          ),
        };
      },
      MAX_BULK,
    );
  }, [csvText]);

  const classified = useMemo(() => {
    const seenInFile = new Set<string>();
    return rows.map((row) => {
      let cls: RowClass;
      if (!row.parsed) {
        cls = "invalid";
      } else {
        const key = row.parsed.email.toLowerCase();
        if (seenInFile.has(key)) {
          cls = "duplicate-in-file";
        } else if (existingSet.has(key)) {
          seenInFile.add(key);
          cls = "duplicate-existing";
        } else {
          seenInFile.add(key);
          cls = "create";
        }
      }
      return { ...row, cls };
    });
  }, [rows, existingSet]);

  const creatable = useMemo(
    () =>
      classified.filter(
        (r): r is CsvParseRow<BulkInviteRow> & { parsed: BulkInviteRow; cls: "create" } =>
          r.cls === "create" && r.parsed !== null,
      ),
    [classified],
  );
  const invalidCount = classified.filter((r) => r.cls === "invalid").length;
  const duplicateCount = classified.filter(
    (r) => r.cls === "duplicate-in-file" || r.cls === "duplicate-existing",
  ).length;

  const clearAll = () => {
    setCsvText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) clearAll();
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) {
      toast.error("CSV must be 1 MB or smaller.");
      event.target.value = "";
      return;
    }
    file.text().then(
      (text) => setCsvText(text),
      () => toast.error("Could not read file."),
    );
  };

  const handleSubmit = () => {
    if (creatable.length === 0) return;
    startTransition(async () => {
      const result = await createPlayerInvitesBatch({
        club_id: clubId,
        invites: creatable.map((r) => ({
          email: r.parsed.email,
          first_name: r.parsed.first_name ?? null,
          last_name: r.parsed.last_name ?? null,
        })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const created = result.data.filter((r) => r.status === "created").length;
      const dup = result.data.filter((r) => r.status === "duplicate").length;
      toast.success(
        `Sent ${created} invite${created === 1 ? "" : "s"}` +
          (dup > 0 ? ` · ${dup} already pending` : ""),
      );
      handleClose(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" data-testid="bulk-invite-trigger">
          Bulk invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Bulk invite players</DialogTitle>
          <DialogDescription>
            Paste CSV text or upload a file. Up to {MAX_BULK} rows per batch.
            Already-known emails are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="bulk-csv-textarea">CSV</Label>
            <Textarea
              id="bulk-csv-textarea"
              data-testid="bulk-csv-textarea"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"email,first_name,last_name\nplayer@club.co.za,Lerato,Ndlovu"}
              rows={6}
              className="font-mono text-xs"
            />
            <p className="mt-1 text-xs text-ink-subtle">
              Headers: <code>email</code>, <code>first_name</code> (optional),{" "}
              <code>last_name</code> (optional).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="text/csv,.csv"
              onChange={handleFile}
              data-testid="bulk-csv-file"
              className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-background hover:file:bg-foreground/90"
            />
            <FileUp className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
          </div>

          {classified.length > 0 && (
            <div data-testid="bulk-csv-preview">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>
                  <strong>{creatable.length}</strong> new ·{" "}
                  <strong>{duplicateCount}</strong> already-known ·{" "}
                  <strong>{invalidCount}</strong> invalid
                </span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
                  data-testid="bulk-csv-clear"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              </div>
              <ul className="max-h-56 overflow-auto rounded-md border border-border text-sm">
                {classified.map((row) => {
                  const Icon =
                    row.cls === "create"
                      ? CheckCircle2
                      : row.cls === "invalid"
                        ? AlertCircle
                        : AlertTriangle;
                  const tone =
                    row.cls === "create"
                      ? "text-success-600"
                      : row.cls === "invalid"
                        ? "text-destructive"
                        : "text-amber-600";
                  const bg =
                    row.cls === "invalid"
                      ? "bg-destructive/5"
                      : row.cls === "create"
                        ? ""
                        : "bg-amber-500/5";
                  return (
                    <li
                      key={row.index}
                      data-testid={`bulk-csv-row-${row.index}`}
                      className={cn(
                        "flex items-start gap-3 border-b border-border px-3 py-2 last:border-b-0",
                        bg,
                      )}
                    >
                      <Icon
                        className={cn("mt-0.5 h-4 w-4 shrink-0", tone)}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-xs text-ink-muted">
                            Row {row.index + 1}
                          </span>
                          <span className="text-xs text-ink-subtle">
                            {CLASS_LABEL[row.cls]}
                          </span>
                        </div>
                        <div className="truncate">
                          {row.raw.first_name || "—"} {row.raw.last_name || ""}{" "}
                          ·{" "}
                          <span className="text-ink-muted">
                            {row.raw.email || "(no email)"}
                          </span>
                        </div>
                        {row.errors.length > 0 && (
                          <ul className="mt-1 list-disc pl-5 text-xs text-destructive">
                            {row.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || creatable.length === 0}
            data-testid="bulk-csv-submit"
          >
            {isPending
              ? "Sending…"
              : `Send ${creatable.length} invite${creatable.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
