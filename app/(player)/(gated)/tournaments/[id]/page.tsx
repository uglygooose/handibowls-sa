import { StubPage } from "@/components/layout/StubPage";

export default async function TournamentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <StubPage
      title="Tournament"
      eyebrow={id}
      phase="Phase 7"
      description="Entries, draws, and live results land here."
    />
  );
}
