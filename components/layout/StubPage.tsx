import { Construction } from "lucide-react";

import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";

type Props = {
  title: string;
  eyebrow?: string;
  description?: string;
};

// Phase 3 placeholder for routes whose real content lands later.
// Renders a PageHeader + an `<EmptyState>` body so the placeholder
// reads as honest empty-state chrome instead of a "Coming soon."
// throwaway. The dev-time `phase` prop was dropped at Phase 12 / 12-7
// (`51db553`); the body rewrite to consume the shared EmptyState
// primitive lands here at Phase 12.5 / 12.5-2 (audit id
// `stub-page-phase-tag`).
//
// Per audit spec: every consumer route currently using `<StubPage>`
// (`/payments`, `/platform/tournaments` super-admin) gets a real
// implementation or a real EmptyState as the route is touched. Until
// then, the EmptyState body is the v1-honest treatment.
export function StubPage({ title, eyebrow, description }: Props) {
  return (
    <>
      <PageHeader title={title} eyebrow={eyebrow} description={description} />
      <div className="p-6">
        <EmptyState
          icon={Construction}
          eyebrow="Coming soon"
          title="This surface is still being built."
          body="The route exists so links + redirects work; the real content lands in a later release."
        />
      </div>
    </>
  );
}
