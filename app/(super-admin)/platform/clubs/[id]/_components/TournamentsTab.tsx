import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { ClubTournament } from "../_data";

export function TournamentsTab({ tournaments }: { tournaments: ClubTournament[] }) {
  if (tournaments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-ink-muted">
        No tournaments hosted by this club yet.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Format</TableHead>
            <TableHead>Structure</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Starts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tournaments.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.name}</TableCell>
              <TableCell className="text-ink-muted">{t.format}</TableCell>
              <TableCell className="text-ink-muted">{t.structure}</TableCell>
              <TableCell>
                <Badge variant={t.status === "published" ? "default" : "outline"}>
                  {t.status}
                </Badge>
              </TableCell>
              <TableCell className="tabular-nums text-ink-muted">
                {t.starts_at ? new Date(t.starts_at).toLocaleDateString() : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
