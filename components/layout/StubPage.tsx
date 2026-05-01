import { Construction } from "lucide-react";

import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { EmptyState } from "@/components/layout/EmptyState";

type Props = {
  title: string;
  eyebrow?: string;
  description?: string;
};

// Phase 3 placeholder for routes whose real content lands later.
// Renders an AdminPageHero + an `<EmptyState>` body so the placeholder
// reads as honest empty-state chrome instead of a "Coming soon."
// throwaway. The dev-time `phase` prop was dropped at Phase 12 / 12-7
// (`51db553`); the body rewrite to consume the shared EmptyState
// primitive landed at Phase 12.5 / 12.5-2 (audit id
// `stub-page-phase-tag`); the page-header migration to the unified
// AdminPageHero primitive lands at Phase 12.5 / 12.5-6 (Stage B).
//
// Per audit spec: every consumer route currently using `<StubPage>`
// (`/payments`) gets a real implementation or a real EmptyState as
// the route is touched. /platform/tournaments was migrated off
// StubPage in 12.5-6 to its own AdminPageHero+EmptyState surface.
export function StubPage({ title, eyebrow, description }: Props) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
      <AdminPageHero
        title={title}
        eyebrow={eyebrow}
        description={description}
        containerWidth="none"
      />
      <EmptyState
        icon={Construction}
        eyebrow="Coming soon"
        title="This surface is still being built."
        body="The route exists so links + redirects work; the real content lands in a later release."
      />
    </div>
  );
}
