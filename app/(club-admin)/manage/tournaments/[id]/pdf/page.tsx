import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/role";

import { PdfPreview } from "./_components/PdfPreview";
import {
  getMatchesForTournament,
  getTournamentDetail,
} from "../_data";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
};

const VALID_TYPES = new Set(["draw", "round", "final"] as const);
type PdfType = "draw" | "round" | "final";

export default async function TournamentPdfPage({ params, searchParams }: Props) {
  await requireRole(["club_admin", "super_admin"]);

  const { id } = await params;
  const sp = await searchParams;
  const type: PdfType = (sp.type && VALID_TYPES.has(sp.type as PdfType)
    ? sp.type
    : "draw") as PdfType;

  const tournament = await getTournamentDetail(id);
  if (!tournament) notFound();

  const matches = await getMatchesForTournament(id);

  return (
    <PdfPreview
      type={type}
      tournament={tournament}
      matches={matches}
    />
  );
}
