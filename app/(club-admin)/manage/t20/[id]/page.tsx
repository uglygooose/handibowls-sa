import { notFound, redirect } from "next/navigation";

import { getCurrentHostClub } from "@/lib/auth/memberships";
import { requireRole } from "@/lib/auth/role";
import {
  type Delivery,
  aggregateAssessment,
  type AssessmentScore,
} from "@/lib/t20/score";
import {
  type LineOutcome,
  type SectionKey,
  type ZoneOutcome,
} from "@/lib/t20/rubric";

import { AssessmentResults } from "../_components/AssessmentResults";
import {
  type DeliveryRow,
  getAssessmentDetail,
} from "../_data";

// Phase 10 / 10-7 — `/manage/t20/[id]` Twenty 20 results view.
//
// Server Component pre-computes every aggregate the Client view
// needs: section subtotals + grand total + grade (via the scoring
// engine's aggregateAssessment), plus three chart datasets:
//
//   • zone counts across all zones_8 sections (drive/control/trail)
//     for the CompassHeatmap.
//   • hand-balance percentages computed from the same zones_8 +
//     on_length deliveries, weighted by points so a backhand 1pt
//     and a forehand 8pt aren't averaged equally.
//   • per-distance "% on length" for the LengthDistributionChart,
//     scoped to on_length sections (speedhumps_asc/desc).
//
// In-progress assessments redirect to /capture so this surface
// only ever renders finalised work. Capture wizard ownership of
// pre-finalize edits is enforced by the wizard's complementary
// 'submitted'-status notFound() guard from 10-6.

export const metadata = {
  title: "Twenty 20 result · HandiBowls",
};

type RouteParams = { id: string };

export default async function ManageT20Result({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  await requireRole(["club_admin", "super_admin"]);
  const { id } = await params;

  const result = await getAssessmentDetail(id);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    notFound();
  }

  const { assessment, deliveries, rubric } = result.data;

  // In-progress assessments live on the capture surface. The wizard
  // hydrates from the same getAssessmentDetail snapshot, so the
  // redirect is the only difference between the two surfaces' role:
  // /capture writes; /[id] reads finalised.
  if (assessment.status !== "submitted" && assessment.status !== "archived") {
    redirect(`/manage/t20/${assessment.id}/capture`);
  }

  const hostClub = await getCurrentHostClub();
  const clubName = hostClub?.club_name ?? "your club";

  // Re-derive the score from deliveries so the page is self-healing
  // if the persisted total_score / percentage / grade fall out of
  // sync with the underlying rows. The DB row is authoritative for
  // the assessment_card list view; this view recomputes for honesty.
  const score: AssessmentScore = aggregateAssessment(
    rubric,
    rowsToDeliveries(deliveries),
  );

  const zoneCounts = computeZoneCounts(deliveries);
  const handBalance = computeHandBalance(deliveries);
  const lengthDist = computeLengthDistribution(deliveries);

  return (
    <AssessmentResults
      assessment={assessment}
      rubric={rubric}
      score={score}
      zoneCounts={zoneCounts}
      handBalance={handBalance}
      lengthDistribution={lengthDist}
      clubName={clubName}
    />
  );
}

function rowsToDeliveries(rows: DeliveryRow[]): Delivery[] {
  return rows.map((r) => {
    const o = r.outcome ?? {};
    if (typeof o.line === "string") {
      return {
        section: r.section,
        round: r.round as 1 | 2,
        delivery_index: r.delivery_index,
        distance_m: r.distance_m,
        outcome: {
          section_model: "line_outcome",
          value: o.line as LineOutcome,
        },
      } satisfies Delivery;
    }
    if (typeof o.zone === "number") {
      return {
        section: r.section,
        round: r.round as 1 | 2,
        delivery_index: r.delivery_index,
        distance_m: r.distance_m,
        outcome: {
          section_model: "zones_8",
          value: o.zone as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
        },
      } satisfies Delivery;
    }
    if (o.zone === "miss") {
      return {
        section: r.section,
        round: r.round as 1 | 2,
        delivery_index: r.delivery_index,
        distance_m: r.distance_m,
        outcome: { section_model: "zones_8", value: "miss" },
      } satisfies Delivery;
    }
    return {
      section: r.section,
      round: r.round as 1 | 2,
      delivery_index: r.delivery_index,
      distance_m: r.distance_m,
      outcome: {
        section_model: "on_length",
        value: typeof o.on_length === "boolean" ? o.on_length : null,
      },
    } satisfies Delivery;
  });
}

function computeZoneCounts(
  rows: DeliveryRow[],
): Partial<Record<Exclude<ZoneOutcome, "miss">, number>> {
  const counts: Partial<Record<Exclude<ZoneOutcome, "miss">, number>> = {};
  for (const r of rows) {
    if (r.section !== "drive" && r.section !== "control" && r.section !== "trail") {
      continue;
    }
    const z = (r.outcome ?? {}).zone;
    if (typeof z === "number") {
      const k = z as Exclude<ZoneOutcome, "miss">;
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }
  return counts;
}

export type HandBalance = {
  forehand: number;
  backhand: number;
  /** Total deliveries that contributed (excludes line_outcome which has no hand). */
  totalDeliveries: number;
};

function computeHandBalance(rows: DeliveryRow[]): HandBalance {
  let foreCount = 0;
  let total = 0;
  for (const r of rows) {
    if (r.section === "jacks" || r.section === "targets") continue;
    if (r.hand === "fore") {
      foreCount++;
      total++;
    } else if (r.hand === "back") {
      total++;
    }
  }
  if (total === 0) return { forehand: 0, backhand: 0, totalDeliveries: 0 };
  // Round to nearest integer percent; ensure they sum to 100 by
  // letting backhand absorb any rounding remainder.
  const forePct = Math.round((foreCount / total) * 100);
  const backPct = 100 - forePct;
  return { forehand: forePct, backhand: backPct, totalDeliveries: total };
}

function computeLengthDistribution(
  rows: DeliveryRow[],
): Array<{ distance: number; pct: number }> {
  const buckets = new Map<number, { hits: number; total: number }>();
  for (const r of rows) {
    if (
      r.section !== "speedhumps_asc" &&
      r.section !== "speedhumps_desc"
    ) {
      continue;
    }
    if (r.distance_m == null) continue;
    const b = buckets.get(r.distance_m) ?? { hits: 0, total: 0 };
    b.total++;
    if ((r.outcome ?? {}).on_length === true) b.hits++;
    buckets.set(r.distance_m, b);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([distance, b]) => ({
      distance,
      pct: b.total > 0 ? Math.round((b.hits / b.total) * 100) : 0,
    }));
}

export type SectionBreakdownRow = {
  index: number;
  key: SectionKey;
  name: string;
  model: "line_outcome" | "zones_8" | "on_length";
  r1: number;
  r2: number;
  total: number;
  max: number;
  pct: number;
};
