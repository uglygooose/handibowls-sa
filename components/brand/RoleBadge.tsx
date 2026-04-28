import { cn } from "@/lib/utils";

import type { Database } from "@/types/database.types";

export type Role = Database["public"]["Enums"]["user_role"];

type Props = {
  role: Role;
  className?: string;
};

// Role badge per the Claude Design treatment: small mono-uppercase chip
// with role-specific colour token. Used in the global users table.
//
//   super_admin → ink/inverse (highest contrast — platform-only)
//   club_admin  → primary-100/primary-600 (theme-aware on themed surfaces;
//                 falls back to neutral on platform Core Black where
//                 primary-500 = #0a0a0a)
//   player      → surface-muted/ink-muted (subdued, most common)
const TONE_BY_ROLE: Record<Role, string> = {
  super_admin: "bg-ink text-ink-inverse",
  club_admin: "bg-primary-100 text-primary-600",
  player: "bg-surface-muted text-ink-muted",
};

const LABEL_BY_ROLE: Record<Role, string> = {
  super_admin: "Super admin",
  club_admin: "Club admin",
  player: "Player",
};

export function RoleBadge({ role, className }: Props) {
  return (
    <span
      data-slot="role-badge"
      data-role={role}
      className={cn(
        "inline-flex rounded-md px-2.5 py-[3px]",
        "font-mono text-[10px] font-bold uppercase tracking-[0.08em]",
        TONE_BY_ROLE[role],
        className,
      )}
    >
      {LABEL_BY_ROLE[role]}
    </span>
  );
}
