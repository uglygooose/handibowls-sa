import { PageHeader } from "@/components/layout/PageHeader";

type Props = {
  title: string;
  eyebrow?: string;
  phase: string;
  description?: string;
};

// Phase 3 placeholder for routes whose real content lands in later phases.
// Renders a PageHeader + a "coming in Phase N" note so redirect verification
// can target real URLs without blocking on feature work.
export function StubPage({ title, eyebrow, phase, description }: Props) {
  return (
    <>
      <PageHeader title={title} eyebrow={eyebrow} description={description} />
      <div className="p-6">
        <p className="text-sm text-ink-muted">Coming in {phase}.</p>
      </div>
    </>
  );
}
