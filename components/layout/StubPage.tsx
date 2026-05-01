import { PageHeader } from "@/components/layout/PageHeader";

type Props = {
  title: string;
  eyebrow?: string;
  description?: string;
};

// Phase 3 placeholder for routes whose real content lands later. Renders a
// PageHeader + a neutral "Coming soon." note so redirect verification can
// target real URLs without blocking on feature work. The original `phase`
// prop was dropped at 12-7 to keep stakeholder UI free of internal
// phase-number tracking-speak.
export function StubPage({ title, eyebrow, description }: Props) {
  return (
    <>
      <PageHeader title={title} eyebrow={eyebrow} description={description} />
      <div className="p-6">
        <p className="text-sm text-ink-muted">Coming soon.</p>
      </div>
    </>
  );
}
