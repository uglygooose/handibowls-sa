import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { ClubGreen } from "../_data";

export function GreensTab({ greens }: { greens: ClubGreen[] }) {
  if (greens.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-border p-6 text-sm text-ink-muted">
        No greens recorded for this club.
      </div>
    );
  }
  return (
    <div className="rounded-[14px] border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Surface</TableHead>
            <TableHead>Rinks</TableHead>
            <TableHead>State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {greens.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="font-medium">{g.name}</TableCell>
              <TableCell className="text-ink-muted">{g.surface ?? "—"}</TableCell>
              <TableCell className="tabular-nums">{g.rink_count}</TableCell>
              <TableCell>
                <Badge variant={g.active ? "default" : "outline"}>
                  {g.active ? "Active" : "Archived"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
