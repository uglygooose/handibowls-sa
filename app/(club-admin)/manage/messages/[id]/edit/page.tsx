import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import { getCurrentHostClub } from "@/lib/auth/memberships";
import { requireRole } from "@/lib/auth/role";

import { ComposeForm } from "../../_components/ComposeForm";
import {
  getMessageDetail,
  listMembersForClub,
  listTournamentsForClub,
} from "../../_data";

// Phase 12 / 12-3 / A3 — `/manage/messages/[id]/edit` admin draft
// editor.
//
// Server Component composes the same hero + form-island handoff as
// /new, but loads an existing draft via getMessageDetail and passes
// it as the form's `edit.initial` prop. The form switches to the
// update path via a hidden `message_id` input that
// composeMessageFromForm dispatches against updateMessageDraft
// instead of createMessageDraft (12-3 / A3 split inside the action).
//
// wrong_state guard: rows that have transitioned out of 'draft'
// (queued / sent / failed) cannot be edited — this page redirects
// such requests back to the list with a notice. Status='queued' is
// transitional today (no scheduler dispatcher); 'sent' / 'failed'
// are terminal.

export const metadata = {
  title: "Edit draft · HandiBowls",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = Promise<{ id: string }>;

export default async function ManageMessagesEditPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(["club_admin", "super_admin"]);
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const [hostClub, detailResult, tournamentsResult, membersResult] =
    await Promise.all([
      getCurrentHostClub(),
      getMessageDetail(id),
      listTournamentsForClub(),
      listMembersForClub(),
    ]);

  if (!hostClub) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-6">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            Club admin
          </span>
          <h1 className="mt-1 font-display text-3xl font-extrabold italic tracking-tight">
            Edit draft
          </h1>
        </header>
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-ink-muted">
            No club is in scope for this account. Use{" "}
            <Link
              href="/platform/clubs"
              className="font-medium text-ink underline"
            >
              Platform · Clubs
            </Link>{" "}
            to pick a club to manage.
          </p>
        </div>
      </div>
    );
  }

  if (!detailResult.ok) {
    if (detailResult.reason === "not-found") notFound();
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-ink-muted">
          Couldn&apos;t load this draft:{" "}
          <span className="text-danger-500">{detailResult.error ?? detailResult.reason}</span>
        </p>
      </div>
    );
  }

  const message = detailResult.data;
  if (message.status !== "draft") {
    // wrong_state — redirect back to the list. The list shows the
    // row as sent/failed/queued; admin can see the same content there.
    redirect(
      `/manage/messages?tab=sent&notice=wrong_state&message=${encodeURIComponent(message.id)}`,
    );
  }

  const splatterPreset = hostClub.club_theme_preset ?? "atomic-red";
  const tournaments = tournamentsResult.ok ? tournamentsResult.rows : [];
  const members = membersResult.ok ? membersResult.rows : [];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-6 py-8 pb-24">
      {/* HERO — same chrome as /new, kicker reads "Edit draft" */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface px-8 py-7">
        <div className="pointer-events-none absolute inset-0 z-0">
          <SpeckleLayer
            seed="messages-edit-hero"
            density="med"
            opacity={0.06}
          />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-10 z-0 opacity-[0.55]"
        >
          <SplatterAccent
            preset={splatterPreset}
            variant={0}
            size={260}
            rotate={18}
          />
        </div>
        <div className="relative z-10 flex min-h-[128px] flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Club admin · Edit draft
            </div>
            <h1 className="mt-1.5 font-display text-[48px] font-black italic leading-[1.05] tracking-tight">
              {message.subject || "Untitled draft"}
            </h1>
            <p className="mt-2 max-w-[64ch] text-[14px] text-ink-muted">
              Update the draft and Save, or Send now to fan it out to the
              audience.
            </p>
          </div>
        </div>
      </div>

      <ComposeForm
        tournaments={tournaments}
        members={members}
        edit={{
          messageId: message.id,
          initial: {
            subject: message.subject,
            body_md: message.body_md,
            audience_kind: message.audience_kind,
            audience_tournament_id: message.audience_tournament_id,
            audience_profile_ids: message.audience_profile_ids,
          },
        }}
      />
    </div>
  );
}
