"use client";

import { Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setPrimaryClub } from "@/lib/club/actions";

export type SwitcherMembership = {
  membership_id: string;
  club_id: string;
  club_name: string;
  is_primary: boolean;
};

type Props = { memberships: SwitcherMembership[] };

// Top-bar club switcher. Renders only when the player has 2+ active
// memberships; below that there's no switching to do. Clicking a
// non-primary entry calls the server action (migration-020 RPC), then
// router.refresh() pulls the new primary into the surrounding layout.
export function ClubSwitcher({ memberships }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (memberships.length < 2) return null;

  const primary =
    memberships.find((m) => m.is_primary) ?? memberships[0];

  const handleSelect = (m: SwitcherMembership) => {
    if (m.is_primary || isPending) return;
    startTransition(async () => {
      const result = await setPrimaryClub(m.membership_id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Primary club set to ${m.club_name}`);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="club-switcher"
          disabled={isPending}
        >
          <span className="max-w-[140px] truncate text-xs">{primary.club_name}</span>
          <ChevronDown className="ml-1 h-3 w-3" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.membership_id}
            data-testid={`club-switcher-option-${m.club_id}`}
            onClick={() => handleSelect(m)}
            disabled={isPending}
          >
            <span className="mr-2 inline-flex h-3.5 w-3.5 items-center justify-center">
              {m.is_primary && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            </span>
            {m.club_name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
