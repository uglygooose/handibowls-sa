import Link from "next/link";

import { BulkInvitePlayersModal } from "./_components/BulkInvitePlayersModal";
import { InvitePlayerModal } from "./_components/InvitePlayerModal";
import { MembersTable } from "./_components/MembersTable";
import { getMembersData } from "./_data";

export const metadata = {
  title: "Members · HandiBowls",
};

export default async function ManageMembers() {
  const data = await getMembersData();

  if (!data.ok) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-6">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            Club admin
          </span>
          <h1 className="mt-1 font-display text-3xl font-extrabold italic tracking-tight">
            Members
          </h1>
        </header>
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-ink-muted">
            No club is in scope for this account. Use{" "}
            <Link href="/platform/clubs" className="font-medium text-ink underline">
              Platform · Clubs
            </Link>{" "}
            to pick a club to manage.
          </p>
        </div>
      </div>
    );
  }

  // Lowercased emails already known to this club. The bulk-invite modal
  // uses this client-side to flag duplicates in the preview before submit;
  // the DB RPC dedupes again as the authoritative check.
  const existingEmails = data.rows
    .map((r) => r.email)
    .filter((e): e is string => Boolean(e));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-2 flex items-end justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            Club admin
          </span>
          <h1 className="mt-1 font-display text-3xl font-extrabold italic tracking-tight">
            Members
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Active players and pending invites. Filter by name or email; click a column to sort.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BulkInvitePlayersModal clubId={data.clubId} existingEmails={existingEmails} />
          <InvitePlayerModal clubId={data.clubId} />
        </div>
      </header>

      <div className="mt-6">
        <MembersTable rows={data.rows} />
      </div>
    </div>
  );
}
