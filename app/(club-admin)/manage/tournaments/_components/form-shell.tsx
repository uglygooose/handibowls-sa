import { cn } from "@/lib/utils";

// Phase 12.5 / 12.5-5 — shared layout primitives for the create
// (`/new`) + edit (`/[id]/edit`) tournament forms. Extracted from
// `app/(club-admin)/manage/tournaments/new/_components/NewTournamentForm.tsx`
// (Phase 7) so the edit page mirrors the create form's section
// structure without duplicating the rendering primitives. Both forms
// now consume `<Section>` / `<Field>` / `<ChipRow>` / `<Chip>` and
// the shared `inputClass` constant.
//
// Pure presentational — no client-state, no server-only — so this
// file lives outside the per-route `_components/` folders to make
// the cross-route consumption obvious.

export const inputClass =
  "h-11 w-full rounded-lg border border-border bg-surface px-3 text-[14px] text-ink placeholder:text-ink-subtle focus:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone disabled:cursor-not-allowed disabled:opacity-60";

export function Section({
  index,
  title,
  desc,
  children,
}: {
  index: string;
  title: React.ReactNode;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 border-b border-border px-7 py-6 last:border-b-0">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          Section {index}
        </span>
        <h2 className="font-display text-2xl font-black tracking-tight">
          {title}
        </h2>
        <p className="text-[13px] text-ink-muted">{desc}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  required,
  helper,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        {label}
        {required && <span className="ml-0.5 text-danger-500">*</span>}
      </span>
      {children}
      {helper && !error && (
        <span className="text-[11px] italic text-ink-subtle">{helper}</span>
      )}
      {error && <span className="text-[11px] text-danger-500">{error}</span>}
    </label>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

export function Chip({
  active,
  locked,
  title,
  onClick,
  children,
}: {
  active: boolean;
  locked?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-active={active}
      data-locked={locked}
      title={title}
      disabled={locked}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
        active
          ? "border-primary-500 bg-primary-500 text-[color:var(--color-on-primary)]"
          : "border-border bg-surface text-ink-muted hover:border-ink-subtle hover:text-ink",
        locked &&
          "cursor-not-allowed opacity-55 hover:border-border hover:text-ink-muted",
      )}
    >
      {children}
    </button>
  );
}
