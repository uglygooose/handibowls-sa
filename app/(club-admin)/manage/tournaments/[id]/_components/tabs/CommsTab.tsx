"use client";

import { Bell, Mail, Send } from "lucide-react";
import { useState } from "react";

import { Bowl } from "@/components/brand/Bowl";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { cn } from "@/lib/utils";

import type { TournamentDetail } from "../../_data";

type Props = {
  tournament: TournamentDetail;
};

type RecipientGroup = "all" | "paid" | "round" | "custom";

export function CommsTab({ tournament }: Props) {
  const [recipients, setRecipients] = useState<RecipientGroup>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [inApp, setInApp] = useState(true);
  const [emailChannel, setEmailChannel] = useState(true);

  const totalEntries = tournament.entries_count;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-2xl font-black tracking-tight">
          Quick message
        </h3>
        <p className="mt-1 text-[13px] text-ink-muted">
          Email + in-app only. SMS and WhatsApp are not enabled in v1
          (Q6 lock).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Composer */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-5 py-5">
          <Field label="Recipients">
            <div className="flex flex-wrap gap-1.5">
              <RecipientChip
                active={recipients === "all"}
                onClick={() => setRecipients("all")}
              >
                All entrants ({totalEntries})
              </RecipientChip>
              <RecipientChip
                active={recipients === "paid"}
                onClick={() => setRecipients("paid")}
              >
                Paid only
              </RecipientChip>
              <RecipientChip
                active={recipients === "round"}
                onClick={() => setRecipients("round")}
              >
                Current round only
              </RecipientChip>
              <RecipientChip
                active={recipients === "custom"}
                onClick={() => setRecipients("custom")}
              >
                Pick teams…
              </RecipientChip>
            </div>
          </Field>

          <Field label="Channel">
            <div className="flex flex-wrap gap-2">
              <ChannelToggle
                active={inApp}
                onClick={() => setInApp((v) => !v)}
                icon={<Bell className="size-4" aria-hidden="true" />}
                label="In-app"
              />
              <ChannelToggle
                active={emailChannel}
                onClick={() => setEmailChannel((v) => !v)}
                icon={<Mail className="size-4" aria-hidden="true" />}
                label="Email"
              />
              <DisabledChannel label="SMS · WhatsApp not in v1" />
            </div>
          </Field>

          <Field label="Subject">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Round 3 starts at 09:00 sharp"
              className="h-11 rounded-lg border border-border bg-surface px-3 text-[14px] text-ink placeholder:text-ink-subtle focus:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
            />
          </Field>

          <Field label="Message (Markdown supported)">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              placeholder={`Hi all,\n\nWrite your update here. Markdown is supported — links, **bold**, lists, the lot.\n\nGood bowls,\n${tournament.host_club.name}`}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-subtle focus:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
            />
          </Field>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <ScheduleChip active>Send now</ScheduleChip>
              <ScheduleChip>Schedule for later…</ScheduleChip>
            </div>
            <button
              type="button"
              disabled
              title="Tournament-scoped comms integration coming soon"
              className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary-500 px-5 text-[13px] font-semibold text-[color:var(--color-on-primary)] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-primary-600"
            >
              <Send className="size-3.5" aria-hidden="true" />
              Send to {totalEntries} {totalEntries === 1 ? "entrant" : "entrants"}
            </button>
          </div>
        </div>

        {/* Email preview + past messages */}
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Email preview
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="h-2 bg-primary-500" />
              <div className="px-6 py-5">
                <div className="mb-3 flex items-center gap-2">
                  <Bowl
                    preset={tournament.host_club.theme_preset as ThemePreset}
                    size={28}
                    seed={tournament.id}
                    emblem={false}
                  />
                  <strong className="font-display text-[18px] font-black tracking-tight">
                    HANDIBOWLS
                  </strong>
                </div>
                <h4 className="mb-2 font-display text-[22px] font-black tracking-tight">
                  {subject || "(no subject yet)"}
                </h4>
                <div className="mb-4 text-[13px] text-ink-muted">
                  From{" "}
                  <strong className="text-ink">
                    {tournament.host_club.name}
                  </strong>{" "}
                  · {tournament.name}
                </div>
                <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
                  {body || (
                    <span className="text-ink-subtle">
                      Compose your message — preview updates live.
                    </span>
                  )}
                </div>
                <hr className="my-4 border-border" />
                <p className="text-[12px] text-ink-subtle">
                  You&apos;re receiving this because you&apos;re entered in
                  this tournament. Manage notifications in your HandiBowls
                  profile.
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Past messages
            </div>
            <div className="rounded-xl border border-dashed border-border bg-surface px-5 py-6 text-center">
              <p className="text-[13px] text-ink-muted">
                Past-message history activates with the Resend integration
                (Phase 11). Messages sent today land here once the
                send-flow is wired.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------- helpers --------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function RecipientChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[12px] font-medium transition-colors",
        active
          ? "border-primary-500 bg-primary-500 text-[color:var(--color-on-primary)]"
          : "border-border bg-surface text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function ChannelToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-colors",
        active
          ? "border-primary-500 bg-primary-100/40 text-primary-500"
          : "border-border bg-surface text-ink-muted hover:text-ink",
      )}
    >
      <input
        type="checkbox"
        checked={active}
        onChange={() => {}}
        className="size-3.5"
        aria-hidden="true"
        tabIndex={-1}
      />
      {icon}
      {label}
    </button>
  );
}

function DisabledChannel({ label }: { label: string }) {
  return (
    <div
      data-disabled
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-border bg-surface-muted px-3 text-[13px] text-ink-muted opacity-60"
    >
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em]">
        Disabled
      </span>
      {label}
    </div>
  );
}

function ScheduleChip({
  active,
  children,
}: {
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-active={active}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-medium transition-colors",
        active
          ? "border-primary-500 bg-primary-500 text-[color:var(--color-on-primary)]"
          : "border-border bg-surface text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
