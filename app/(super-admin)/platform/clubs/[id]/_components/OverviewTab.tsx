import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { ClubDetail } from "../_data";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-ink-muted">{label}</span>
      <span className="text-right">{value || <span className="text-ink-muted">—</span>}</span>
    </div>
  );
}

export function OverviewTab({
  club,
  counts,
}: {
  club: ClubDetail;
  counts: { admins: number; greens: number; members: number; tournaments: number };
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Club details</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/50">
          <Row label="Name" value={club.name} />
          <Row label="Short name" value={club.short_name} />
          <Row label="Slug" value={<code className="text-xs">{club.slug}</code>} />
          <Row label="District" value={club.district_name} />
          <Row label="City" value={club.city} />
          <Row label="Theme preset" value={<code className="text-xs">{club.theme_preset}</code>} />
          <Row
            label="State"
            value={club.active ? "Active" : "Archived"}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/50">
          <Row label="Email" value={club.contact_email} />
          <Row label="Phone" value={club.contact_phone} />
          <Row label="Logo path" value={club.logo_url} />
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Counts</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Admins", value: counts.admins },
              { label: "Greens", value: counts.greens },
              { label: "Members", value: counts.members },
              { label: "Tournaments", value: counts.tournaments },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col gap-1 rounded-lg border border-border/50 p-3"
              >
                <dt className="text-xs uppercase tracking-wide text-ink-muted">
                  {stat.label}
                </dt>
                <dd className="font-display text-2xl tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
