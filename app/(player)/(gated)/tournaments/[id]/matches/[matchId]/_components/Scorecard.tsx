"use client";

import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Lock,
  MapPin,
  Trophy,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { OfflineSyncBadge, type SyncState } from "@/components/player/OfflineSyncBadge";
import { WakeLockIndicator } from "@/components/player/WakeLockIndicator";
import { WetHandsToggle } from "@/components/player/WetHandsToggle";
import { EndStepper } from "@/components/player/EndStepper";
import { BottomSheet } from "@/components/player/BottomSheet";

// Phase 12 / 12-5: lazy-load the two conditional surfaces so the
// scorecard's initial Client Component bundle drops by the size of
// these two components. Both render only behind a state branch
// (DisputeForm inside the dispute BottomSheet; OpponentConfirmationCard
// only when match.submission_status === 'captain_submitted' AND the
// caller is the opponent), so deferring their chunk to first-use
// doesn't change the initial paint for the most common scorecard
// states (in_progress, completed).
const OpponentConfirmationCard = dynamic(
  () =>
    import("@/components/player/OpponentConfirmationCard").then((m) => ({
      default: m.OpponentConfirmationCard,
    })),
  { ssr: false },
);
const DisputeForm = dynamic(
  () =>
    import("@/components/player/DisputeForm").then((m) => ({
      default: m.DisputeForm,
    })),
  { ssr: false },
);
import { confirmMatch, submitMatch } from "@/app/(club-admin)/manage/tournaments/_actions";
import {
  deleteMatchEnd,
  listMatchEndsForMatch,
  markSubmissionError,
  markSubmissionSynced,
  queueSubmission,
  upsertMatchEnd as upsertMatchEndLocal,
} from "@/lib/scorecard/outbox";
import { useOutboxFlush } from "@/lib/scorecard/use-outbox-flush";
import { useSyncState } from "@/lib/scorecard/use-sync-state";
import { useWakeLock } from "@/lib/scorecard/use-wake-lock";
import { useWetHands } from "@/lib/scorecard/use-wet-hands";
import { cn } from "@/lib/utils";

import type { ScorecardMatch } from "../_data";

// Phase 8c — THE SCORECARD. Full-bleed fixed overlay above the player
// layout chrome. Highest-care surface in the rebuild — the brief
// flagged this as the densest, most error-prone, most user-facing
// surface. Density is intentional. Wet-hands ugliness is intentional.
//
// Architecture
//
//   Server Component fetches the match + tournament context
//        ↓ (props: ScorecardMatch)
//   <Scorecard /> (this file) — Client Component
//        ↓ subscribes to Dexie matchEnds via dexie-react-hooks
//        ↓ owns wake-lock + wet-hands hooks
//        ↓ owns the optimistic write chain (Dexie first, server second)
//        ↓ branches on match.status + match.finalized_by_admin to
//           render the right state-machine variant
//        ↓ delegates 3 primitives: <EndStepper />, <OpponentConfirmationCard />,
//           <DisputeForm /> — extracted to components/player/
//
// State machine (mapped to existing schema enums)
//
//   scheduled              → "Tap a side to start scoring"
//   in_progress            → live scoring (steppers + End complete + Submit final)
//   completed (finalized=false) → "Awaiting opponent / admin verification"
//                                  + opponent confirmation card if player is the
//                                  OPP side (8d will distinguish captain_submitted
//                                  vs opponent_confirmed when the schema lands)
//   completed (finalized=true)  → "Match verified" lock screen
//   walkover               → walkover notice (read-only)
//   cancelled              → cancelled notice (read-only)
//
// Phase 8g — offline-conflict UI stripped. The Phase 8d wiring (outbox
// flush returns `remote_newer`, ConflictResolutionSheet renders a
// use-mine / use-theirs / dispute modal) was removed because real-world
// concurrent same-end scoring across two devices, one offline, both
// syncing through different timestamps is effectively zero for bowls.
// Server-side last-write-wins via migration 027 is the only conflict
// story now: whichever flush completes the UPDATE last wins. Dexie
// outbox + auto-flush on reconnect remain — that's the offline path
// players genuinely benefit from.

type Props = {
  match: ScorecardMatch;
  /** Path to navigate back to when the user closes the scorecard. */
  backHref: string;
};

export function Scorecard({ match: initialMatch, backHref }: Props) {
  const router = useRouter();
  const wakeLock = useWakeLock();
  const wetHands = useWetHands();
  const [pending, startTransition] = useTransition();
  const [pendingHome, setPendingHome] = useState(0);
  const [pendingAway, setPendingAway] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<"idle" | "queued" | "submitted">("idle");

  // Phase 8d outbox flush worker — auto-flushes on online + visibility
  // events. `useSyncState` derives the header sync badge from Dexie
  // counts. The Phase 8d conflict pipeline was stripped in 8g; the
  // worker is now the simple "upsert each queued row" loop.
  const flush = useOutboxFlush();
  const sync = useSyncState();
  const flushNow = flush.flushNow;

  // Dexie live query — match_ends rolling log. SSR-safe via the
  // server-only guard inside getDb(); useLiveQuery returns undefined
  // on the first render then the rows.
  const ends = useLiveQuery(
    () => (typeof window === "undefined" ? Promise.resolve([]) : listMatchEndsForMatch(initialMatch.match_id)),
    [initialMatch.match_id],
    [],
  );

  // Rolling totals derived from the local ends log + the match's
  // server-side handicap-start adjustments. Client never writes to
  // matches.home_shots / away_shots directly — server derives from
  // the ends log on flush (8d). For 8c the local totals drive the UI.
  const { localHomeTotal, localAwayTotal } = useMemo(() => {
    const handicapHome =
      initialMatch.tournament.handicap_rule === "handicap_start"
        ? initialMatch.home_handicap_shots
        : 0;
    const handicapAway =
      initialMatch.tournament.handicap_rule === "handicap_start"
        ? initialMatch.away_handicap_shots
        : 0;
    let h = handicapHome;
    let a = handicapAway;
    for (const e of ends ?? []) {
      h += e.homeShots;
      a += e.awayShots;
    }
    return { localHomeTotal: h, localAwayTotal: a };
  }, [ends, initialMatch]);

  const target = initialMatch.tournament.shots_up_target ?? null;
  const targetReached =
    target != null && (localHomeTotal >= target || localAwayTotal >= target);

  // Current end number = ends.length + 1 (next end yet to be played).
  // When all ends through the target are done the UI shifts to
  // "Submit final" rather than another end.
  const currentEndNumber = (ends ?? []).length + 1;

  const playerScore = initialMatch.player_is_home ? localHomeTotal : localAwayTotal;
  const opponentScore = initialMatch.player_is_home ? localAwayTotal : localHomeTotal;
  const lead = Math.abs(playerScore - opponentScore);
  const playerLeading = playerScore > opponentScore;

  // Phase 8d-prep state-machine branches. The submission_status enum
  // (migration 026) gives us proper distinction between captain-
  // submitted and opponent-confirmed; isLive now means "the match is
  // still being played" — captain hasn't submitted final scores yet.
  const isLive =
    (initialMatch.status === "in_progress" ||
      initialMatch.status === "scheduled") &&
    initialMatch.submission_status === "pending";
  const awaitingOpponentConfirm =
    initialMatch.submission_status === "captain_submitted";
  const awaitingAdminVerify =
    initialMatch.submission_status === "opponent_confirmed" &&
    !initialMatch.finalized_by_admin;
  const verified =
    initialMatch.status === "completed" && initialMatch.finalized_by_admin;
  const walkover = initialMatch.status === "walkover";
  const cancelled = initialMatch.status === "cancelled";

  // Wake-lock acquisition tied to the first +/- tap (iOS Safari
  // requirement — must be inside a user gesture).
  function ensureWakeLockOnGesture() {
    if (!wakeLock.active && !wakeLock.unsupported) {
      void wakeLock.acquire();
    }
  }

  function bumpHome(delta: number) {
    ensureWakeLockOnGesture();
    setPendingHome((v) => clampShots(v + delta));
    if (delta > 0) setPendingAway(0);
  }
  function bumpAway(delta: number) {
    ensureWakeLockOnGesture();
    setPendingAway((v) => clampShots(v + delta));
    if (delta > 0) setPendingHome(0);
  }

  // Quick-shots row 1-8: tap N to set the player's side to N shots,
  // zeroing the opponent's. Mirrors the design source's quick-shots
  // semantics (`setMark({ home: n, away: 0 })` always for YOU) but
  // adapted to player-is-home/away orientation so an away-side player
  // taps "5" → opponent's-team-of-the-match `away_shots = 5` from the
  // schema's POV. Net effect for the player is identical: "I won 5".
  function applyQuickShot(shots: number) {
    ensureWakeLockOnGesture();
    if (initialMatch.player_is_home) {
      setPendingHome(shots);
      setPendingAway(0);
    } else {
      setPendingAway(shots);
      setPendingHome(0);
    }
  }

  function openConfirm() {
    if (pendingHome === 0 && pendingAway === 0) return;
    setConfirmOpen(true);
  }

  // Commit the current end to Dexie. Last-write-wins by (matchId,
  // endNumber) — re-confirming an end overwrites the previous row.
  async function commitEnd() {
    await upsertMatchEndLocal({
      matchId: initialMatch.match_id,
      endNumber: currentEndNumber,
      homeShots: pendingHome,
      awayShots: pendingAway,
    });
    setPendingHome(0);
    setPendingAway(0);
    setConfirmOpen(false);
    // Trigger an opportunistic flush — common path is "online while
    // scoring" where the row should sync within a second of commit.
    void flushNow();
  }

  async function deleteEnd(endNumber: number) {
    await deleteMatchEnd(initialMatch.match_id, endNumber);
  }

  // Mark peel — a drawn end where neither team scored. Commits a 0/0
  // row directly, bypassing the confirm sheet (peels are decisive — no
  // numeric edit to confirm). Mirrors the design source's outline-button
  // treatment as a one-tap action.
  async function commitPeel() {
    ensureWakeLockOnGesture();
    setPendingHome(0);
    setPendingAway(0);
    await upsertMatchEndLocal({
      matchId: initialMatch.match_id,
      endNumber: currentEndNumber,
      homeShots: 0,
      awayShots: 0,
    });
    void flushNow();
  }

  // Skip — end abandoned / not played (rare: weather, rink moved,
  // disputed bowl). Same row shape as peel for now (0/0); future
  // differentiation via a `notes` flag is logged as Phase 12 polish
  // drift since the design source's button is a UI-only stub with no
  // implemented contract.
  async function commitSkip() {
    ensureWakeLockOnGesture();
    setPendingHome(0);
    setPendingAway(0);
    await upsertMatchEndLocal({
      matchId: initialMatch.match_id,
      endNumber: currentEndNumber,
      homeShots: 0,
      awayShots: 0,
    });
    void flushNow();
  }

  // "Submit final" — calls submitMatch with the local totals (server
  // doesn't yet derive from match_ends; 8d wires that). Optimistic
  // queue to Dexie first so an offline tap survives a refresh.
  async function submitFinal() {
    setServerError(null);
    await queueSubmission(initialMatch.match_id, localHomeTotal, localAwayTotal);
    setSubmissionState("queued");
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      // Stay queued — the 8d service-worker flush will retry.
      return;
    }
    startTransition(async () => {
      const result = await submitMatch({
        match_id: initialMatch.match_id,
        home_shots: localHomeTotal,
        away_shots: localAwayTotal,
      });
      if (!result.ok) {
        await markSubmissionError(initialMatch.match_id, result.error);
        setServerError(result.error);
        setSubmissionState("queued");
        return;
      }
      await markSubmissionSynced(initialMatch.match_id);
      setSubmissionState("submitted");
      router.refresh();
    });
  }

  // Opponent-side path: call confirmMatch (the existing action) when
  // the player views a match the captain has already submitted.
  async function confirmAsOpponent() {
    setServerError(null);
    startTransition(async () => {
      const result = await confirmMatch({ match_id: initialMatch.match_id });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function openDispute() {
    setDisputeOpen(true);
  }

  // ---- render ---------------------------------------------------------

  // Sync state surfaces in the header. Phase 8d wires it to the live
  // Dexie outbox state via useSyncState. Server errors from the inline
  // submitMatch call (the optimistic-online path) bump it to "error"
  // even when no Dexie row is errored — the user needs the visible cue
  // to retry.
  const syncState: SyncState = useMemo(() => {
    if (serverError) return "error";
    return sync.state;
  }, [serverError, sync.state]);

  return (
    <div
      data-slot="scorecard"
      data-wet-hands={wetHands.on ? "on" : "off"}
      className={cn(
        // Full-bleed overlay above the player layout chrome (TopBar
        // z-30 + PlayerBottomNav z-40). Fixed root means safe-area
        // insets need an explicit grid + padding rather than the
        // normal flow.
        "fixed inset-0 z-[60] grid grid-rows-[auto_1fr_auto] overflow-hidden",
        wetHands.on
          ? "bg-[#0A0A0A] text-[#f5b700]"
          : "bg-bone text-ink",
      )}
    >
      {/* Sticky top strip */}
      <ScorecardHeader
        match={initialMatch}
        backHref={backHref}
        currentEndNumber={ends?.length ? ends.length : currentEndNumber}
        target={target}
        playerLeading={playerLeading}
        wetHands={wetHands.on}
        onWetHandsToggle={wetHands.toggle}
        wakeLockActive={wakeLock.active}
        syncState={syncState}
        pendingCount={(ends ?? []).filter((e) => e.syncStatus !== "synced").length}
      />

      {/* Body — branches on match status */}
      <div className="relative overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-6 pt-4">
          {/* Scoreboard — always visible */}
          <Scoreboard
            match={initialMatch}
            playerScore={playerScore}
            opponentScore={opponentScore}
            lead={lead}
            playerLeading={playerLeading}
            target={target}
            wetHands={wetHands.on}
          />

          {/* Handicap-start callout */}
          {initialMatch.tournament.handicap_rule === "handicap_start" && (
            <HandicapNotice
              match={initialMatch}
              wetHands={wetHands.on}
            />
          )}

          {/* State-machine branch */}
          {walkover && <ReadOnlyNotice tone="warning" title="Walkover recorded" body="No further scoring on this match." />}
          {cancelled && <ReadOnlyNotice tone="danger" title="Match cancelled" body="The admin cancelled this match. No score is recorded." />}
          {verified && <VerifiedBanner playerWon={playerLeading} wetHands={wetHands.on} />}
          {awaitingOpponentConfirm && (
            <CaptainSubmittedBranch
              match={initialMatch}
              localHomeTotal={localHomeTotal}
              localAwayTotal={localAwayTotal}
              onConfirm={confirmAsOpponent}
              onDispute={openDispute}
              pending={pending}
            />
          )}
          {awaitingAdminVerify && (
            <AwaitingAdminVerify wetHands={wetHands.on} />
          )}

          {/* Live scoring controls */}
          {isLive && !targetReached && (
            <LiveScoringControls
              currentEndNumber={currentEndNumber}
              pendingHome={pendingHome}
              pendingAway={pendingAway}
              playerIsHome={initialMatch.player_is_home}
              homeName={initialMatch.home_team_name}
              awayName={initialMatch.away_team_name}
              onHomeIncrement={() => bumpHome(1)}
              onHomeDecrement={() => bumpHome(-1)}
              onAwayIncrement={() => bumpAway(1)}
              onAwayDecrement={() => bumpAway(-1)}
              onQuickShot={applyQuickShot}
              onConfirmEnd={openConfirm}
              onPeel={commitPeel}
              onSkip={commitSkip}
              wetHands={wetHands.on}
            />
          )}

          {isLive && targetReached && submissionState !== "submitted" && (
            <ReadyToSubmitCard
              playerLeading={playerLeading}
              playerScore={playerScore}
              opponentScore={opponentScore}
              onSubmit={submitFinal}
              pending={pending}
              wetHands={wetHands.on}
            />
          )}

          {/* End-by-end recap */}
          {(ends?.length ?? 0) > 0 && (
            <EndsHistory
              ends={ends ?? []}
              expanded={showHistory}
              onToggle={() => setShowHistory((v) => !v)}
              onDeleteEnd={deleteEnd}
              wetHands={wetHands.on}
            />
          )}

          {serverError && (
            <p className="rounded-[14px] border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-[15px] text-ink">
              {serverError}
            </p>
          )}
        </div>
      </div>

      {/* Sticky bottom — submit final shows here too when target reached */}
      {isLive && !targetReached && (
        <StickyBottomCTA
          ready={pendingHome > 0 || pendingAway > 0}
          onConfirmEnd={openConfirm}
          currentEndNumber={currentEndNumber}
          wetHands={wetHands.on}
        />
      )}

      {/* Confirm-end bottom sheet */}
      <BottomSheet open={confirmOpen} onOpenChange={setConfirmOpen}>
        <BottomSheet.Content>
          <div className="flex flex-col gap-3 px-4 pb-2 pt-1">
            <BottomSheet.Title asChild>
              <h3 className="font-display text-[22px] font-black italic uppercase tracking-tight">
                Confirm end {currentEndNumber}
              </h3>
            </BottomSheet.Title>
            <BottomSheet.Description className="text-[15px] text-ink-muted">
              Locking this end will be hard to undo. The admin can still
              override final scores.
            </BottomSheet.Description>
            <div className="flex flex-col gap-1.5 rounded-[14px] border border-border bg-surface p-3 font-mono text-[13px]">
              <ConfRow
                label={initialMatch.home_team_name}
                from={localHomeTotal - pendingHome}
                to={localHomeTotal}
              />
              <ConfRow
                label={initialMatch.away_team_name}
                from={localAwayTotal - pendingAway}
                to={localAwayTotal}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-[14px] border border-border bg-surface text-[13px] font-medium text-ink hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void commitEnd()}
                className="inline-flex h-11 flex-[2] items-center justify-center gap-1 rounded-[14px] bg-primary-500 text-[13px] font-extrabold uppercase tracking-[0.04em] text-[color:var(--color-on-primary)]"
              >
                Save end <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </BottomSheet.Content>
      </BottomSheet>

      {/* Dispute form */}
      <BottomSheet open={disputeOpen} onOpenChange={setDisputeOpen}>
        <BottomSheet.Content>
          <BottomSheet.Title className="sr-only">Dispute scores</BottomSheet.Title>
          <DisputeForm
            initial={{
              home_shots: initialMatch.home_shots,
              away_shots: initialMatch.away_shots,
            }}
            yourLabel={initialMatch.player_is_home ? initialMatch.home_team_name : initialMatch.away_team_name}
            opponentLabel={initialMatch.player_is_home ? initialMatch.away_team_name : initialMatch.home_team_name}
            onCancel={() => setDisputeOpen(false)}
            onSubmit={async () => {
              // 8d: dispute is recorded client-side only. The action-side
              // dispute path (write to a disputes table + notify admin)
              // is Phase 11 alongside the comms wiring; until then closing
              // the form is the right local UX.
              setDisputeOpen(false);
            }}
          />
        </BottomSheet.Content>
      </BottomSheet>
    </div>
  );
}

// ---- subcomponents (kept inline; route-scoped) -----------------------

function ScorecardHeader({
  match,
  backHref,
  currentEndNumber,
  target,
  playerLeading,
  wetHands,
  onWetHandsToggle,
  wakeLockActive,
  syncState,
  pendingCount,
}: {
  match: ScorecardMatch;
  backHref: string;
  currentEndNumber: number;
  target: number | null;
  playerLeading: boolean;
  wetHands: boolean;
  onWetHandsToggle: () => void;
  wakeLockActive: boolean;
  syncState: SyncState;
  pendingCount: number;
}) {
  return (
    <header
      className={cn(
        "flex items-center gap-2 border-b px-3 pt-[max(8px,env(safe-area-inset-top))]",
        wetHands ? "border-[#2a2a00] bg-[#0A0A0A]" : "border-border bg-bone",
      )}
    >
      <Link
        href={backHref}
        aria-label="Close scorecard"
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
          wetHands
            ? "bg-[#1a1a00] text-[#f5b700]"
            : "bg-surface-muted text-ink hover:bg-surface",
        )}
      >
        <X className="size-5" aria-hidden="true" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "font-mono text-[10px] font-bold uppercase tracking-[0.12em]",
            wetHands ? "text-[#c08f00]" : "text-ink-muted",
          )}
        >
          Match #{match.match_no ?? "—"} ·{" "}
          {match.tournament.name.length > 32
            ? match.tournament.name.slice(0, 30) + "…"
            : match.tournament.name}
        </span>
        <span
          className={cn(
            "font-mono text-[12px] font-extrabold uppercase tracking-[0.06em]",
            wetHands ? "text-[#f5b700]" : "text-ink",
          )}
        >
          End {currentEndNumber}
          {target != null && ` · First to ${target}`}
          {playerLeading && " · You lead"}
          {match.rink && (
            <>
              {" · "}
              <MapPin className="-mt-0.5 inline size-3" aria-hidden="true" /> {match.rink}
            </>
          )}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 pb-1">
        <WakeLockIndicator active={wakeLockActive} />
        <OfflineSyncBadge state={syncState} pendingCount={pendingCount} />
        <WetHandsToggle on={wetHands} onToggle={onWetHandsToggle} />
      </div>
    </header>
  );
}

function Scoreboard({
  match,
  playerScore,
  opponentScore,
  lead,
  playerLeading,
  target,
  wetHands,
}: {
  match: ScorecardMatch;
  playerScore: number;
  opponentScore: number;
  lead: number;
  playerLeading: boolean;
  target: number | null;
  wetHands: boolean;
}) {
  const playerName = match.player_is_home ? match.home_team_name : match.away_team_name;
  const opponentName = match.player_is_home ? match.away_team_name : match.home_team_name;
  return (
    <section
      className={cn(
        "grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 rounded-2xl border p-3",
        wetHands ? "border-[#2a2a00] bg-[#0A0A0A]" : "border-border bg-surface",
      )}
    >
      <SideScore label="You" name={playerName} value={playerScore} tone="you" wetHands={wetHands} />
      <div className="flex flex-col items-center justify-center gap-1 px-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]",
            wetHands ? "bg-[#f5b700] text-[#0A0A0A]" : "bg-primary-500/12 text-ink",
          )}
        >
          End total
        </span>
        {target != null && (
          <span
            className={cn(
              "font-mono text-[10.5px] uppercase tracking-[0.08em]",
              wetHands ? "text-[#c08f00]" : "text-ink-muted",
            )}
          >
            First to {target}
          </span>
        )}
        <span
          className={cn(
            "font-mono text-[11px] font-bold uppercase tracking-[0.08em]",
            wetHands ? "text-[#f5b700]" : playerLeading ? "text-success-700" : "text-warning-700",
          )}
        >
          {lead === 0 ? "Tied" : playerLeading ? `+${lead} ahead` : `−${lead} behind`}
        </span>
      </div>
      <SideScore label="Opp" name={opponentName} value={opponentScore} tone="opp" wetHands={wetHands} />
    </section>
  );
}

function SideScore({
  label,
  name,
  value,
  tone,
  wetHands,
}: {
  label: string;
  name: string;
  value: number;
  tone: "you" | "opp";
  wetHands: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1 rounded-[14px] px-2 py-2", wetHands ? "bg-[#161000]" : "bg-surface-muted/40")}>
      <span
        className={cn(
          "font-mono text-[11px] font-bold uppercase tracking-[0.12em]",
          wetHands ? "text-[#c08f00]" : tone === "you" ? "text-accent-ink" : "text-warning-700",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-display font-black italic leading-none tabular-nums",
          wetHands ? "text-[80px] text-[#f5b700]" : "text-[64px] text-ink",
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          "max-w-full truncate text-center text-[12px] font-bold",
          wetHands ? "text-[#c08f00]" : "text-ink-muted",
        )}
      >
        {name}
      </span>
    </div>
  );
}

function HandicapNotice({ match, wetHands }: { match: ScorecardMatch; wetHands: boolean }) {
  const yourBonus = match.player_is_home ? match.home_handicap_shots : match.away_handicap_shots;
  return (
    <div
      className={cn(
        "rounded-[10px] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.06em]",
        wetHands ? "bg-[#1a1a00] text-[#c08f00]" : "bg-warning-500/12 text-ink ring-1 ring-inset ring-warning-500/30",
      )}
    >
      Handicap start ·{" "}
      {yourBonus > 0
        ? `your team starts with +${yourBonus} shots`
        : "no bonus this match"}
    </div>
  );
}

export function LiveScoringControls(props: {
  currentEndNumber: number;
  pendingHome: number;
  pendingAway: number;
  playerIsHome: boolean;
  homeName: string;
  awayName: string;
  onHomeIncrement: () => void;
  onHomeDecrement: () => void;
  onAwayIncrement: () => void;
  onAwayDecrement: () => void;
  onQuickShot: (shots: number) => void;
  onConfirmEnd: () => void;
  onPeel: () => void;
  onSkip: () => void;
  wetHands: boolean;
}) {
  const { wetHands, pendingHome, pendingAway, playerIsHome } = props;
  return (
    <section className="flex flex-col gap-3">
      <div
        className={cn(
          "flex items-center justify-between font-mono text-[11px] font-bold uppercase tracking-[0.08em]",
          wetHands ? "text-[#c08f00]" : "text-ink-muted",
        )}
      >
        <span>Score this end</span>
        <span>Who won · how many</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <EndStepper
          label={playerIsHome ? "You" : props.homeName}
          tone={playerIsHome ? "you" : "opp"}
          value={pendingHome}
          onIncrement={props.onHomeIncrement}
          onDecrement={props.onHomeDecrement}
          wetHands={wetHands}
        />
        <EndStepper
          label={playerIsHome ? props.awayName : "You"}
          tone={playerIsHome ? "opp" : "you"}
          value={pendingAway}
          onIncrement={props.onAwayIncrement}
          onDecrement={props.onAwayDecrement}
          wetHands={wetHands}
        />
      </div>

      {/* Quick-shot chips: 1..8 — design source's row of 8 buttons that
          set the player's side to N shots and zero the opponent. */}
      <div
        data-slot="quick-shots"
        className="grid grid-cols-8 gap-1"
      >
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => props.onQuickShot(n)}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-lg font-mono text-[14px] font-extrabold tabular-nums",
              wetHands
                ? "border-2 border-[#f5b700] bg-[#1a1a00] text-[#f5b700]"
                : "border border-border bg-surface text-ink hover:bg-surface-muted",
            )}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Mark peel + Skip — outline secondary actions per the design
          source. Both bypass the confirm sheet (decisive single-tap):
          peel commits a 0/0 row (drawn end); skip records an
          abandoned end with the same 0/0 shape (Phase 12 polish entry
          tracks splitting peel vs skipped via match_ends.notes). */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          data-slot="mark-peel"
          onClick={props.onPeel}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border font-mono text-[12px] font-bold uppercase tracking-[0.06em]",
            wetHands
              ? "border-2 border-[#f5b700] bg-[#1a1a00] text-[#f5b700]"
              : "border-border bg-surface text-ink hover:bg-surface-muted",
          )}
        >
          <Eye className="size-3.5" aria-hidden="true" />
          Mark peel
        </button>
        <button
          type="button"
          data-slot="skip-end"
          onClick={props.onSkip}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border font-mono text-[12px] font-bold uppercase tracking-[0.06em]",
            wetHands
              ? "border-2 border-[#4a3700] bg-[#0A0A0A] text-[#c08f00]"
              : "border-border bg-surface text-ink hover:bg-surface-muted",
          )}
        >
          <X className="size-3.5" aria-hidden="true" />
          Skip
        </button>
      </div>
    </section>
  );
}

function EndsHistory({
  ends,
  expanded,
  onToggle,
  onDeleteEnd,
  wetHands,
}: {
  ends: { matchId: string; endNumber: number; homeShots: number; awayShots: number }[];
  expanded: boolean;
  onToggle: () => void;
  onDeleteEnd: (n: number) => Promise<void>;
  wetHands: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-[14px] border",
        wetHands ? "border-[#2a2a00] bg-[#0A0A0A]" : "border-border bg-surface",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em]",
          wetHands ? "text-[#c08f00]" : "text-ink-muted",
        )}
      >
        <span>End-by-end · {ends.length} {ends.length === 1 ? "end" : "ends"}</span>
        {expanded ? (
          <ChevronUp className="size-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-4" aria-hidden="true" />
        )}
      </button>
      {expanded && (
        <ul className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3">
          {ends.map((e) => (
            <li
              key={e.endNumber}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg px-2 py-1.5 font-mono",
                e.homeShots > e.awayShots
                  ? wetHands ? "bg-[#1a1a00]" : "bg-success-500/12"
                  : e.awayShots > e.homeShots
                    ? wetHands ? "bg-[#1a0000]" : "bg-warning-500/12"
                    : wetHands ? "bg-[#0a0a0a]" : "bg-surface-muted",
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.08em]">End {e.endNumber}</span>
              <span className="text-[12px]">
                {e.homeShots}–{e.awayShots}
              </span>
              <button
                type="button"
                onClick={() => void onDeleteEnd(e.endNumber)}
                className="text-[10px] font-bold uppercase tracking-[0.08em] text-danger-500 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StickyBottomCTA({
  ready,
  onConfirmEnd,
  currentEndNumber,
  wetHands,
}: {
  ready: boolean;
  onConfirmEnd: () => void;
  currentEndNumber: number;
  wetHands: boolean;
}) {
  return (
    <div
      className={cn(
        "border-t px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2",
        wetHands ? "border-[#2a2a00] bg-[#0A0A0A]" : "border-border bg-bone",
      )}
    >
      <button
        type="button"
        disabled={!ready}
        onClick={onConfirmEnd}
        className={cn(
          "inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-extrabold uppercase tracking-[0.04em] transition-colors disabled:opacity-40",
          wetHands
            ? "bg-[#f5b700] text-[#0A0A0A]"
            : "bg-primary-500 text-[color:var(--color-on-primary)]",
        )}
      >
        End complete · End {currentEndNumber} <ArrowRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function ReadyToSubmitCard({
  playerLeading,
  playerScore,
  opponentScore,
  onSubmit,
  pending,
  wetHands,
}: {
  playerLeading: boolean;
  playerScore: number;
  opponentScore: number;
  onSubmit: () => void;
  pending: boolean;
  wetHands: boolean;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-2 px-4 py-4",
        wetHands ? "border-[#f5b700] bg-[#1a1a00]" : playerLeading ? "border-success-500 bg-success-500/8" : "border-warning-500 bg-warning-500/8",
      )}
    >
      <div className="flex items-center gap-2">
        <Trophy className="size-5" aria-hidden="true" />
        <strong className="font-display text-[20px] font-black italic uppercase">
          {playerLeading ? "You won" : "Result locked"}
        </strong>
      </div>
      <p className="font-mono text-[13px] font-bold tabular-nums">
        Final · {playerScore} – {opponentScore}
      </p>
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending}
        className={cn(
          "inline-flex h-14 items-center justify-center gap-2 rounded-2xl text-[14px] font-extrabold uppercase tracking-[0.04em] disabled:opacity-60",
          wetHands ? "bg-[#f5b700] text-[#0A0A0A]" : "bg-ink text-ink-inverse",
        )}
      >
        {pending ? "Submitting…" : "Submit final"}
        <ArrowRight className="size-4" aria-hidden="true" />
      </button>
    </section>
  );
}

// Phase 8d follow-up — Migration 029 closes the Phase-12-polish gap.
// Branch on `submitted_by_team_id`:
//
//   • caller's team_id == submitted_by_team_id → AwaitingOpponentConfirm
//     passive banner. The captain who just submitted shouldn't see a
//     "Confirm result" button — they'd self-confirm, sliding the
//     match through the state machine without the opponent ever
//     touching it. The visible-but-inert state pre-029 caused
//     Diagnostic 14.
//
//   • caller's team_id != submitted_by_team_id → OpponentConfirmationCard
//     (the active "Confirm" / "Dispute" card).
//
//   • submitted_by_team_id == null → legacy fallback. Pre-029 rows
//     don't carry the audit signal; admin-override paths (verifyMatch
//     with override scores) also skip it. Render the active card —
//     same as the pre-029 behaviour, so legacy / dev-seed data still
//     works. The captain self-confirm bug only re-surfaces for these
//     legacy rows; new matches submitted post-029 are protected.
export function CaptainSubmittedBranch({
  match,
  localHomeTotal,
  localAwayTotal,
  onConfirm,
  onDispute,
  pending,
}: {
  match: ScorecardMatch;
  localHomeTotal: number;
  localAwayTotal: number;
  onConfirm: () => void;
  onDispute: () => void;
  pending: boolean;
}) {
  const callerTeamId = match.player_is_home
    ? match.home_team_id
    : match.away_team_id;
  const callerIsSubmitter =
    match.submitted_by_team_id != null &&
    match.submitted_by_team_id === callerTeamId;

  if (callerIsSubmitter) {
    return <AwaitingOpponentConfirm />;
  }

  return (
    <OpponentConfirmationCard
      yourScore={match.player_is_home ? localHomeTotal : localAwayTotal}
      opponentScore={match.player_is_home ? localAwayTotal : localHomeTotal}
      yourLabel={match.player_is_home ? match.home_team_name : match.away_team_name}
      opponentLabel={match.player_is_home ? match.away_team_name : match.home_team_name}
      onConfirm={onConfirm}
      onDispute={onDispute}
      pending={pending}
    />
  );
}

function AwaitingOpponentConfirm() {
  return (
    <section
      data-slot="awaiting-opponent-confirm"
      className="flex items-center gap-3 rounded-2xl border-2 border-info-500 bg-info-500/8 px-4 py-4 text-ink"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-info-500/15">
        <Check className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-0.5">
        <strong className="font-display text-[18px] font-black italic uppercase tracking-tight">
          Score submitted
        </strong>
        <p className="text-[13px]">
          Awaiting opponent confirmation — they&apos;ll confirm or dispute the result.
        </p>
      </div>
    </section>
  );
}

function AwaitingAdminVerify({ wetHands }: { wetHands: boolean }) {
  return (
    <section
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 px-4 py-4",
        wetHands
          ? "border-[#f5b700] bg-[#1a1a00] text-[#f5b700]"
          : "border-info-500 bg-info-500/8 text-ink",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          wetHands ? "bg-[#f5b700]/20" : "bg-info-500/15",
        )}
      >
        <Check className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-0.5">
        <strong className="font-display text-[18px] font-black italic uppercase tracking-tight">
          Both captains agree
        </strong>
        <p className="text-[13px]">
          Awaiting admin verification — the result locks once admin signs off.
        </p>
      </div>
    </section>
  );
}

function VerifiedBanner({ playerWon, wetHands }: { playerWon: boolean; wetHands: boolean }) {
  return (
    <section
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-6 text-center",
        wetHands
          ? "border-[#f5b700] bg-[#1a1a00] text-[#f5b700]"
          : "border-success-500 bg-success-500/8 text-ink",
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-success-500/20">
        <Lock className="size-6" aria-hidden="true" />
      </span>
      <strong className="font-display text-[24px] font-black italic uppercase tracking-tight">
        Match verified
      </strong>
      <p className="text-[13px]">
        {playerWon ? "Bowled. The result is locked." : "The result is locked. Better luck next round."}
      </p>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
        <Check className="size-3" aria-hidden="true" /> Admin verified
      </span>
    </section>
  );
}

function ReadOnlyNotice({
  tone,
  title,
  body,
}: {
  tone: "warning" | "danger";
  title: string;
  body: string;
}) {
  const cls =
    tone === "warning"
      ? "border-warning-500 bg-warning-500/10 text-ink"
      : "border-danger-500 bg-danger-500/10 text-ink";
  return (
    <section className={cn("flex flex-col gap-1 rounded-2xl border-2 px-4 py-4", cls)}>
      <strong className="font-display text-[18px] font-black italic uppercase tracking-tight">
        {title}
      </strong>
      <p className="text-[13px] text-ink">{body}</p>
    </section>
  );
}

function ConfRow({ label, from, to }: { label: string; from: number; to: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="truncate">{label}</span>
      <span className="font-bold tabular-nums">
        {from} → {to}
      </span>
    </div>
  );
}

function clampShots(n: number): number {
  if (Number.isNaN(n) || n < 0) return 0;
  if (n > 8) return 8;
  return n;
}

