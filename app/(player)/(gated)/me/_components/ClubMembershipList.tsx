"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setPrimaryClub } from "@/lib/club/actions";

export type MembershipListRow = {
  membership_id: string;
  club_id: string;
  club_name: string;
  club_grading: "skip" | "third" | "second" | "lead" | null;
  is_primary: boolean;
  joined_at: string;
};

const GRADING_LABEL: Record<string, string> = {
  skip: "Skip",
  third: "Third",
  second: "Second",
  lead: "Lead",
};

type Props = { memberships: MembershipListRow[] };

export function ClubMembershipList({ memberships }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (memberships.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-border p-6 text-sm text-ink-muted">
        Not a member of any club yet. Ask a club admin to invite you.
      </div>
    );
  }

  const handleMakePrimary = (m: MembershipListRow) => {
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
    <ul className="space-y-2" data-testid="club-membership-list">
      {memberships.map((m) => (
        <li
          key={m.membership_id}
          data-testid={`club-membership-${m.club_id}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{m.club_name}</span>
              {m.is_primary && (
                <Badge variant="default" data-testid={`primary-badge-${m.club_id}`}>
                  Primary
                </Badge>
              )}
            </div>
            <div className="text-xs text-ink-muted">
              {m.club_grading ? GRADING_LABEL[m.club_grading] ?? "—" : "Grading not set"} ·
              joined {new Date(m.joined_at).toLocaleDateString("en-ZA")}
            </div>
          </div>
          {!m.is_primary && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleMakePrimary(m)}
              disabled={isPending}
              data-testid={`make-primary-${m.club_id}`}
            >
              {isPending ? "…" : "Make primary"}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
