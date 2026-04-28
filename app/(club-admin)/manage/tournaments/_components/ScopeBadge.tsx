import { Globe, MapPin, Shield } from "lucide-react";

import { cn } from "@/lib/utils";

import type { TournamentScope } from "../_data";

const SCOPE_LABEL: Record<TournamentScope, string> = {
  club: "Club",
  district: "District",
  provincial: "Provincial",
  national: "National",
};

const SCOPE_ICON: Record<TournamentScope, typeof Shield> = {
  club: Shield,
  district: MapPin,
  provincial: MapPin,
  national: Globe,
};

type Props = {
  scope: TournamentScope;
  className?: string;
};

export function ScopeBadge({ scope, className }: Props) {
  const Icon = SCOPE_ICON[scope];
  return (
    <span
      data-slot="scope-badge"
      data-scope={scope}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-medium tracking-tight text-ink-muted ring-1 ring-inset ring-border",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {SCOPE_LABEL[scope]}
    </span>
  );
}
