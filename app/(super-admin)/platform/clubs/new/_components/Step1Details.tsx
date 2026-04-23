"use client";

import type { DistrictRow } from "../../_data";

type Props = { districts: DistrictRow[] };

export function Step1Details({ districts }: Props) {
  return (
    <div data-testid="step-1-details" className="text-sm text-muted-foreground">
      <p>Step 1 — Club details (shell).</p>
      <p>
        Fields (name, short name, slug, district, city, contacts, logo, theme
        preset) land in the next commit. Districts loaded:{" "}
        <strong>{districts.length}</strong>.
      </p>
    </div>
  );
}
