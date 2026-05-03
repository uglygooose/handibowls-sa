import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { requireRole } from "@/lib/auth/role";

import { getUserDetail, type UserDetail } from "../_data";

const ROLE_LABEL: Record<UserDetail["role"], string> = {
  super_admin: "Super admin",
  club_admin: "Club admin",
  player: "Player",
};

function fullName(u: UserDetail): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return full || u.display_name || u.email || u.id;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

type Params = Promise<{ id: string }>;

export default async function PlatformUserDetail({ params }: { params: Params }) {
  await requireRole(["super_admin"]);
  const { id } = await params;

  const user = await getUserDetail(id);
  if (!user) notFound();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
      <AdminPageHero
        titleSize="detail"
        eyebrow="Platform · User"
        title={fullName(user)}
        description={user.email ?? "No email on record"}
        actions={
          <Button asChild variant="outline">
            <Link href="/platform/users">Back to users</Link>
          </Button>
        }
        containerWidth="none"
      />

      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <h2 className="font-display text-sm uppercase tracking-widest text-ink-muted">
            Profile
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-muted">Role</dt>
              <dd className="mt-1">
                <Badge variant="outline">{ROLE_LABEL[user.role]}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-muted">
                Profile completion
              </dt>
              <dd className="mt-1">
                <Badge variant={user.profile_completed ? "default" : "outline"}>
                  {user.profile_completed ? "Completed" : "Pending"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-muted">Phone</dt>
              <dd className="mt-1 text-ink">{user.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-muted">
                Display name
              </dt>
              <dd className="mt-1 text-ink">{user.display_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-muted">Created</dt>
              <dd className="mt-1 tabular-nums text-ink">
                {formatTimestamp(user.created_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-muted">Updated</dt>
              <dd className="mt-1 tabular-nums text-ink">
                {formatTimestamp(user.updated_at)}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-sm uppercase tracking-widest text-ink-muted">
            Club memberships
          </h2>
          {user.memberships.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No club memberships.</p>
          ) : (
            <div className="mt-4 rounded-[14px] border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Club</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.memberships.map((m) => (
                    <TableRow
                      key={m.club_id}
                      data-testid={`user-membership-${m.club_id}`}
                    >
                      <TableCell>
                        <Link
                          href={`/platform/clubs/${m.club_id}`}
                          className="font-medium text-ink hover:underline"
                        >
                          {m.club_name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={m.status === "active" ? "default" : "outline"}
                        >
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {m.is_primary ? (
                          <Badge variant="default">Primary</Badge>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums text-ink-muted">
                          {formatDate(m.joined_at)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-sm uppercase tracking-widest text-ink-muted">
            Club admin assignments
          </h2>
          {user.admin_assignments.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No admin assignments.</p>
          ) : (
            <div className="mt-4 rounded-[14px] border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Club</TableHead>
                    <TableHead>Assigned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.admin_assignments.map((a) => (
                    <TableRow
                      key={a.club_id}
                      data-testid={`user-assignment-${a.club_id}`}
                    >
                      <TableCell>
                        <Link
                          href={`/platform/clubs/${a.club_id}`}
                          className="font-medium text-ink hover:underline"
                        >
                          {a.club_name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums text-ink-muted">
                          {formatTimestamp(a.assigned_at)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
