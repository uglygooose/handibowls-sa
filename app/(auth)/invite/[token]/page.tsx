import { lookupInvite } from "@/lib/auth/actions";
import { InviteForm } from "./invite-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await lookupInvite(token);

  if (!invite.ok) {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-bold text-ink">
          Invite unavailable
        </h1>
        <p className="rounded-md bg-danger-500/10 p-3 text-sm text-danger-500">
          {invite.error}
        </p>
        <p className="text-sm text-ink-muted">
          Ask the club admin to send a fresh invite.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <span className="font-display text-xs tracking-widest uppercase text-ink-muted">
          {invite.clubName}
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Accept your invite
        </h1>
        <p className="text-sm text-ink-muted">
          You&apos;re joining as {invite.role === "club_admin" ? "a club admin" : "a player"}{" "}
          at {invite.clubName}. Set a password to get started.
        </p>
      </div>

      <InviteForm token={token} email={invite.email} />
    </div>
  );
}
