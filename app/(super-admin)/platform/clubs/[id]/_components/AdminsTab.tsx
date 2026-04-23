import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { ClubAdmin } from "../_data";

function displayName(a: ClubAdmin) {
  const full = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
  return full || a.display_name || a.email || a.profile_id;
}

export function AdminsTab({ admins }: { admins: ClubAdmin[] }) {
  if (admins.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-ink-muted">
        No club admins yet. Invite one from the list view action menu.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Assigned</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {admins.map((a) => (
            <TableRow key={a.profile_id}>
              <TableCell className="font-medium">{displayName(a)}</TableCell>
              <TableCell>{a.email ?? "—"}</TableCell>
              <TableCell className="tabular-nums text-ink-muted">
                {new Date(a.assigned_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
