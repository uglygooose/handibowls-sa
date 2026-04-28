import { Badge } from "@/components/ui/badge";

type Props = {
  // profiles.novice_registered_at — date string from the schema (no time
  // component). Null until the player completes /me/setup.
  noviceRegisteredAt: string | null;
};

// BSA novice rule: a member is a "novice" for the first 3 years after
// registration as a bowler. Registration = first profile completion (the
// /me/setup wizard sets novice_registered_at via the migration-019 RPC).
// Renders nothing once the window expires.
export function NoviceBadge({ noviceRegisteredAt }: Props) {
  if (!noviceRegisteredAt) return null;
  const start = new Date(`${noviceRegisteredAt}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  const expiry = new Date(start);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 3);
  if (expiry <= new Date()) return null;

  return (
    <Badge variant="secondary" data-testid="novice-badge">
      Novice
    </Badge>
  );
}
