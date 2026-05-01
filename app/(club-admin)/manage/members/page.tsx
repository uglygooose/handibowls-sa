import Link from "next/link";

import { AdminPageHero } from "@/components/layout/AdminPageHero";

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
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 pb-24">
        <AdminPageHero eyebrow="Club admin" title="Members" containerWidth="none" />
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
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 pb-24">
      <AdminPageHero
        eyebrow="Club admin"
        title="Members"
        description="Active players and pending invites. Filter by name or email; click a column to sort."
        actions={
          <>
            <BulkInvitePlayersModal clubId={data.clubId} existingEmails={existingEmails} />
            <InvitePlayerModal clubId={data.clubId} />
          </>
        }
        containerWidth="none"
      />

      <MembersTable rows={data.rows} />
    </div>
  );
}
