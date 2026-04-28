"use client";

import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { HandiBowlsWordmark } from "@/components/brand/HandiBowlsWordmark";
import { cn } from "@/lib/utils";

type Variant = "light" | "dark" | "platform";

type Props = {
  title?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  variant?: Variant;
  className?: string;
  // For variant="platform" only — initials shown in the foot avatar tile
  // (mirrors the AdminSidebar foot identity). Layouts derive from the auth
  // context's email and pass through.
  userInitial?: string;
};

// Friendly labels for known route segments. Anything not in the map is
// title-cased fallback. UUIDs collapse to "Detail" because the URL slug is
// useless to a human reader; pages with friendlier names (club detail,
// user detail) surface them in the page heading instead of the breadcrumb.
const SEGMENT_LABEL: Record<string, string> = {
  platform: "Platform",
  manage: "Manage",
  clubs: "Clubs",
  districts: "Districts",
  users: "Users",
  tournaments: "Tournaments",
  rubrics: "Rubrics",
  settings: "Settings",
  audit: "Audit log",
  new: "New club",
  members: "Members",
  greens: "Greens",
  messages: "Messages",
  t20: "T20",
  overview: "Overview",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function labelFor(segment: string): string {
  if (SEGMENT_LABEL[segment]) return SEGMENT_LABEL[segment];
  if (UUID_RE.test(segment)) return "Detail";
  return (
    segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
  );
}

function pathToCrumbs(pathname: string | null): string[] {
  // Always lead with the brand prefix per the design's PTopBar
  //   ["HandiBowls", ...routeSegments]
  if (!pathname) return ["HandiBowls"];
  const segs = pathname.split("/").filter(Boolean);
  return ["HandiBowls", ...segs.map(labelFor)];
}

export function TopBar({
  title,
  left,
  right,
  variant = "light",
  userInitial = "?",
  className,
}: Props) {
  if (variant === "platform") {
    return <PlatformTopBar userInitial={userInitial} className={className} />;
  }

  // Original light / dark variants — unchanged. Used by (club-admin) and
  // (player) layouts. Their full design pass is owned by Phase 7 (mirrors
  // the AdminSidebar variant pattern from earlier this session).
  const isDark = variant === "dark";
  return (
    <header
      data-slot="top-bar"
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4",
        isDark
          ? "border-sidebar-border bg-surface-inverse text-ink-inverse"
          : "border-border bg-surface text-ink",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {left}
        {title ? (
          <h1 className="truncate font-display text-lg font-bold tracking-tight">
            {title}
          </h1>
        ) : (
          <HandiBowlsWordmark variant={isDark ? "dark" : "light"} height={24} />
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {right}
        <SignOutButton variant={isDark ? "dark" : "light"} />
      </div>
    </header>
  );
}

// Platform variant per the Claude Design treatment:
//   - sticky 64px bar, bone bg, 1px border
//   - mono uppercase Platform tag pill (ink bg, primary-500 dot prefix
//     with a 3px Atomic Red glow)
//   - breadcrumbs derived from usePathname(); active leaf bold-ink
//   - right rail: Notifications bell + initial avatar + Sign-out button
function PlatformTopBar({
  userInitial,
  className,
}: {
  userInitial: string;
  className?: string;
}) {
  const pathname = usePathname();
  const crumbs = pathToCrumbs(pathname);

  return (
    <header
      data-slot="top-bar"
      data-variant="platform"
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-bone px-8",
        className,
      )}
    >
      <span
        data-slot="topbar-platform-tag"
        className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-inverse"
      >
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-primary-500 shadow-[0_0_0_3px_rgba(215,38,30,0.3)]"
        />
        Platform
      </span>

      <nav
        aria-label="Breadcrumb"
        data-slot="topbar-crumbs"
        className="flex items-center gap-2 text-[13px] text-ink-muted"
      >
        {crumbs.map((c, i) => (
          <Fragment key={`${i}-${c}`}>
            {i > 0 && (
              <span
                aria-hidden="true"
                className="font-mono text-ink-subtle"
              >
                /
              </span>
            )}
            {i === crumbs.length - 1 ? (
              <strong className="font-semibold text-ink">{c}</strong>
            ) : (
              <span>{c}</span>
            )}
          </Fragment>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2.5">
        {/* Bell is decorative for now — notifications system isn't built.
            title attribute hints "coming soon"; no onClick keeps it from
            implying false interactivity. Wire when the notifications
            surface lands. */}
        <button
          type="button"
          aria-label="Notifications"
          title="Notifications · coming soon"
          data-slot="topbar-bell"
          className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-transparent text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <Bell className="size-4" aria-hidden="true" />
        </button>
        <span
          aria-hidden="true"
          data-slot="topbar-avatar"
          className="flex size-9 items-center justify-center rounded-full bg-ink font-display text-sm font-extrabold text-ink-inverse"
        >
          {userInitial}
        </span>
        <SignOutButton variant="light" />
      </div>
    </header>
  );
}
