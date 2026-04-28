"use client";

import { Command } from "cmdk";
import {
  GitFork,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  FileText,
  Flag,
  Grid3x3,
  History,
  LayoutDashboard,
  Lock,
  Megaphone,
  Plus,
  Printer,
  Search,
  Shield,
  Sparkles,
  Thermometer,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  advanceRound,
  cancelTournament,
  closeEntries,
  completeTournament,
} from "@/app/(club-admin)/manage/tournaments/_actions";
import { cn } from "@/lib/utils";

// ⌘K command palette. Mounted from the (club-admin) layout via a thin
// client wrapper; the cmdk library + this component are bundled into a
// route-group chunk that only loads when an admin user lands.
//
// Items grouped per the design source (cmdk.jsx):
//   • Tournament (when on a detail page) — Advance / Close entries /
//     Complete / Duplicate / Cancel
//   • Match (when on a detail page) — Open next incomplete (deferred —
//     see DRIFT) / Verify all submitted (deferred — wires through
//     ScoringTab's bulk-finalize)
//   • Print (when on a detail page) — Draw / Round scoresheet / Final
//     results / Export entries CSV. All open the /pdf surface with a
//     ?type= param so 7d's PDF templates render.
//   • Navigate — tab jumps + list / new / pdf preview
//   • Help — About / Keyboard shortcuts
//
// When the user is NOT on a detail page, tournament-context items hide
// entirely (rather than rendering disabled, which would be visual
// noise). Navigate items always show.

type Props = {
  /** When mounted at the layout level: undefined. The component derives
   *  current tournament from URL via usePathname(). Caller doesn't need
   *  to thread context. */
  initialOpen?: boolean;
};

const TOURNAMENT_PATH_RE = /^\/manage\/tournaments\/([0-9a-f-]{36})/i;

export default function TournamentCommandPalette({
  initialOpen = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(initialOpen);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const tournamentId = (() => {
    const m = pathname.match(TOURNAMENT_PATH_RE);
    return m ? m[1] : null;
  })();

  // ⌘K (mac) / Ctrl+K (others) toggles. Esc handled by Command.Dialog.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function close() {
    setOpen(false);
  }

  function navigate(path: string) {
    close();
    router.push(path);
  }

  function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    startTransition(async () => {
      try {
        await fn();
        close();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setActionError(message);
      }
    });
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Tournament command palette"
      // cmdk renders a Radix dialog; styling via globals + inline.
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[10vh]"
      contentClassName="w-full max-w-[640px] overflow-hidden rounded-2xl bg-surface shadow-2xl"
    >
      {/* Input row */}
      <div className="relative flex items-center border-b border-border">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
        />
        <Command.Input
          placeholder="Type a command, search teams, jump to a tab…"
          className="h-14 w-full bg-transparent pl-12 pr-32 text-[14px] text-ink placeholder:text-ink-subtle focus:outline-none"
        />
        <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <Kbd>↵</Kbd>
          <Kbd>Esc</Kbd>
        </div>
      </div>

      {/* List */}
      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="px-4 py-8 text-center">
          <p className="text-[13px] text-ink-muted">
            No matches. Try &quot;round&quot;, &quot;scoring&quot;,
            &quot;team name&quot;, or &quot;print&quot;.
          </p>
        </Command.Empty>

        {tournamentId && (
          <>
            <Command.Group
              heading="Tournament"
              className="mb-1 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted"
            >
              <Item
                icon={ChevronRight}
                label="Advance to next round"
                meta="advanceRound"
                onSelect={() =>
                  runAction(async () => {
                    // Best-effort: if the action returns incomplete, surface
                    // the message in actionError without crashing.
                    const result = await advanceRound({
                      tournament_id: tournamentId,
                      round_no: -1,
                    });
                    if (!result.ok) throw new Error(result.error);
                    router.refresh();
                  })
                }
                disabled={pending}
              />
              <Item
                icon={Lock}
                label="Close entries"
                meta="closeEntries"
                onSelect={() =>
                  runAction(async () => {
                    const result = await closeEntries({ tournament_id: tournamentId });
                    if (!result.ok) throw new Error(result.error);
                    router.refresh();
                  })
                }
                disabled={pending}
              />
              <Item
                icon={Trophy}
                label="Complete tournament"
                meta="completeTournament"
                onSelect={() =>
                  runAction(async () => {
                    const result = await completeTournament({
                      tournament_id: tournamentId,
                    });
                    if (!result.ok) throw new Error(result.error);
                    router.refresh();
                  })
                }
                disabled={pending}
              />
              <Item
                icon={Copy}
                label="Duplicate this tournament"
                meta="creates draft · Phase 12"
                onSelect={() => close()}
                disabled
              />
              <Item
                icon={X}
                label="Cancel tournament"
                meta="cancelTournament · destructive"
                onSelect={() =>
                  runAction(async () => {
                    const result = await cancelTournament({
                      tournament_id: tournamentId,
                    });
                    if (!result.ok) throw new Error(result.error);
                    router.refresh();
                  })
                }
                disabled={pending}
              />
            </Command.Group>

            <Command.Group
              heading="Match"
              className="mb-1 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted"
            >
              <Item
                icon={Sparkles}
                label="Open next incomplete match"
                meta="navigation deferred · Phase 12"
                onSelect={() => navigate(`/manage/tournaments/${tournamentId}?tab=draw`)}
              />
              <Item
                icon={Flag}
                label="Verify all submitted matches"
                meta="admin_finalize_matches_batch via Scoring tab"
                onSelect={() =>
                  navigate(`/manage/tournaments/${tournamentId}?tab=scoring`)
                }
              />
            </Command.Group>

            <Command.Group
              heading="Print"
              className="mb-1 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted"
            >
              <Item
                icon={Printer}
                label="Print draw (PDF)"
                meta="DrawSheet"
                onSelect={() =>
                  navigate(`/manage/tournaments/${tournamentId}/pdf?type=draw`)
                }
              />
              <Item
                icon={Printer}
                label="Print current round scoresheet (PDF)"
                meta="RoundScoresheet"
                onSelect={() =>
                  navigate(`/manage/tournaments/${tournamentId}/pdf?type=round`)
                }
              />
              <Item
                icon={Printer}
                label="Print final results (PDF)"
                meta="FinalResults · pending complete"
                onSelect={() =>
                  navigate(`/manage/tournaments/${tournamentId}/pdf?type=final`)
                }
              />
              <Item
                icon={Download}
                label="Export entries as CSV"
                meta="opens Entries tab"
                onSelect={() =>
                  navigate(`/manage/tournaments/${tournamentId}?tab=entries`)
                }
              />
            </Command.Group>
          </>
        )}

        <Command.Group
          heading="Navigate"
          className="mb-1 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted"
        >
          {tournamentId && (
            <>
              <NavItem
                icon={GitFork}
                label="Jump to bracket"
                meta="Tab · Draw"
                onSelect={() =>
                  navigate(`/manage/tournaments/${tournamentId}?tab=draw`)
                }
              />
              <NavItem
                icon={Grid3x3}
                label="Jump to scoring"
                meta="Tab · Scoring"
                onSelect={() =>
                  navigate(`/manage/tournaments/${tournamentId}?tab=scoring`)
                }
              />
              <NavItem
                icon={Users}
                label="Jump to entries"
                meta="Tab · Entries"
                onSelect={() =>
                  navigate(`/manage/tournaments/${tournamentId}?tab=entries`)
                }
              />
              <NavItem
                icon={Thermometer}
                label="Jump to rinks heatmap"
                meta="Tab · Rinks"
                onSelect={() =>
                  navigate(`/manage/tournaments/${tournamentId}?tab=rinks`)
                }
              />
              <NavItem
                icon={Megaphone}
                label="Jump to comms"
                meta="Tab · Comms"
                onSelect={() =>
                  navigate(`/manage/tournaments/${tournamentId}?tab=comms`)
                }
              />
              <NavItem
                icon={History}
                label="Jump to audit log"
                meta="Tab · Audit"
                onSelect={() =>
                  navigate(`/manage/tournaments/${tournamentId}?tab=audit`)
                }
              />
            </>
          )}
          <NavItem
            icon={LayoutDashboard}
            label="All tournaments"
            meta="/manage/tournaments"
            onSelect={() => navigate("/manage/tournaments")}
          />
          <NavItem
            icon={Plus}
            label="New tournament"
            meta="/manage/tournaments/new"
            onSelect={() => navigate("/manage/tournaments/new")}
          />
          <NavItem
            icon={ClipboardList}
            label="Members"
            meta="/manage/members"
            onSelect={() => navigate("/manage/members")}
          />
        </Command.Group>

        <Command.Group
          heading="Help"
          className="mb-1 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted"
        >
          <NavItem
            icon={Shield}
            label="About HandiBowls"
            meta="v0.7 · Phase 7"
            onSelect={close}
          />
          <NavItem
            icon={FileText}
            label="Keyboard shortcuts"
            meta="?"
            onSelect={close}
          />
        </Command.Group>
      </Command.List>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 font-mono text-[11px] text-ink-subtle">
        <span>cmdk · {tournamentId ? "tournament context active" : "global"}</span>
        <span>{actionError ? `Error: ${actionError}` : "Press ⌘K to toggle"}</span>
      </div>
    </Command.Dialog>
  );
}

// -------------------- helpers --------------------

function Item({
  icon: Icon,
  label,
  meta,
  onSelect,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  meta?: string;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <Command.Item
      onSelect={() => {
        if (!disabled) onSelect();
      }}
      disabled={disabled}
      className={cn(
        "group flex h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 text-[13px] aria-selected:bg-primary-500/10 aria-selected:text-ink",
        disabled && "cursor-not-allowed opacity-55",
      )}
    >
      <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
      <span className="flex-1 truncate">{label}</span>
      {meta && (
        <span className="font-mono text-[11px] text-ink-subtle">{meta}</span>
      )}
    </Command.Item>
  );
}

function NavItem(props: {
  icon: LucideIcon;
  label: string;
  meta?: string;
  onSelect: () => void;
}) {
  return <Item {...props} />;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-muted px-1 font-mono text-[10px] text-ink-muted">
      {children}
    </kbd>
  );
}
