import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  return new Date(iso).toISOString().slice(0, 10);
}

const ROLE_LABEL: Record<UserRow["role"], string> = {
  super_admin: "Super admin",
  club_admin: "Club admin",
  player: "Player",
};

// Pure server component — no TanStack Table client glue. Search + pagination
// drive through the URL so the RSC re-renders with fresh data.
export function UsersTable({ rows, page, pageSize, total, q, basePath }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-3" data-slot="users-table">
      <div className="rounded-[14px] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Clubs</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-ink-muted">
                  {q
                    ? `No users match “${q}”.`
                    : "No users found."}
                </TableCell>
              </TableRow>
            ) : (
              <TooltipProvider>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-testid={`user-row-${row.id}`}
                  >
                    <TableCell>
                      <Link
                        href={`${basePath}/${row.id}`}
                        className="font-medium text-ink hover:underline"
                      >
                        {row.display}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-ink-muted">{row.email ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROLE_LABEL[row.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      {row.clubs.length === 0 ? (
                        <span className="text-ink-muted">—</span>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="cursor-default tabular-nums underline decoration-dotted underline-offset-2"
                              data-testid={`user-clubs-${row.id}`}
                            >
                              {row.clubs.length}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <ul className="flex flex-col gap-0.5">
                              {row.clubs.map((c) => (
                                <li key={c.id}>{c.name}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums text-ink-muted">
                        {formatDate(row.created_at)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TooltipProvider>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-muted tabular-nums">
          {total === 0
            ? "0 results"
            : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted tabular-nums">
            Page {page} of {totalPages}
          </span>
          {/* Phase 13 / 13-1 / commit 7: aria-label with page-context. */}
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link
              href={buildHref(basePath, Math.max(1, page - 1), q)}
              aria-label={`Previous page (Page ${page} of ${totalPages})`}
              aria-disabled={page <= 1}
              className={cn(page <= 1 && "pointer-events-none opacity-50")}
            >
              Previous
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
            <Link
              href={buildHref(basePath, Math.min(totalPages, page + 1), q)}
              aria-label={`Next page (Page ${page} of ${totalPages})`}
              aria-disabled={page >= totalPages}
              className={cn(page >= totalPages && "pointer-events-none opacity-50")}
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
