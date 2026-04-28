import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { ClubChip } from "@/components/brand/ClubChip";
import { RoleBadge } from "@/components/brand/RoleBadge";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { UserRow } from "../_data";

type Props = {
  rows: UserRow[];
  page: number;
  pageSize: number;
  total: number;
  q: string;
  basePath: string;
};

function buildHref(basePath: string, page: number, q: string): string {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initialsFor(display: string): string {
  return display
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

// Pure server component — no TanStack Table client glue. Search + pagination
// drive through the URL so the RSC re-renders with fresh data. NO
// impersonation surface per Q11 (deferred to v2, see DRIFT_LOG.md and the
// Phase-4-prep impersonation lockout).
export function UsersTable({ rows, page, pageSize, total, q, basePath }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing matches."
        description={
          q
            ? `Try a different name, email, or BSA number.`
            : "No users on the platform yet."
        }
        bowlPreset="midnight"
        idSuffix="users-empty"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4" data-slot="users-table">
      <div className="overflow-hidden rounded-[14px] border border-border bg-bone">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["User", "Email", "Role", "Clubs", "BSA #", "Joined"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="border-b border-border bg-surface px-4 py-3.5 text-left font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-subtle"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                data-testid={`user-row-${row.id}`}
                className="h-16 border-b border-border last:border-b-0 hover:bg-[rgba(215,38,30,0.04)]"
              >
                <td className="px-4 py-3.5 align-middle text-sm">
                  <Link
                    href={`${basePath}/${row.id}`}
                    className="flex items-center gap-2.5"
                    data-testid={`user-link-${row.id}`}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted font-display text-xs font-bold text-ink">
                      {initialsFor(row.display)}
                    </span>
                    <strong className="font-medium text-ink hover:underline">
                      {row.display}
                    </strong>
                  </Link>
                </td>
                <td className="px-4 py-3.5 align-middle font-mono text-[13px] text-ink-muted">
                  {row.email ?? "—"}
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <RoleBadge role={row.role} />
                </td>
                <td className="px-4 py-3.5 align-middle">
                  {row.clubs.length === 0 ? (
                    <span className="text-ink-subtle italic">—</span>
                  ) : (
                    <div
                      className="flex flex-wrap gap-1"
                      data-testid={`user-clubs-${row.id}`}
                    >
                      {row.clubs.map((c) => (
                        <ClubChip
                          key={c.id}
                          short={c.short_name ?? c.name.slice(0, 4).toUpperCase()}
                        />
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3.5 align-middle font-mono text-sm font-semibold">
                  {row.bsa_number ?? <span className="text-ink-subtle font-normal">—</span>}
                </td>
                <td className="px-4 py-3.5 align-middle font-mono text-[12px] text-ink-muted">
                  {formatDate(row.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-border bg-surface px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-subtle">
          <span>
            {total === 0
              ? "0 results"
              : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
          </span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={page <= 1}
                className="size-8 rounded-md p-0"
              >
                <Link
                  href={buildHref(basePath, Math.max(1, page - 1), q)}
                  aria-label="Previous page"
                  aria-disabled={page <= 1}
                  className={cn(page <= 1 && "pointer-events-none opacity-50")}
                >
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                className="size-8 rounded-md p-0"
              >
                <Link
                  href={buildHref(basePath, Math.min(totalPages, page + 1), q)}
                  aria-label="Next page"
                  aria-disabled={page >= totalPages}
                  className={cn(
                    page >= totalPages && "pointer-events-none opacity-50",
                  )}
                >
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
