"use client";

import type { DistrictRow } from "../../_data";

type Props = { districts: DistrictRow[] };

export function Step5Review({ districts }: Props) {
  return (
    <div data-testid="step-5-review" className="text-sm text-muted-foreground">
      Step 5 — Review &amp; publish (shell). Review cards + publish land in a
      later commit. Districts available for label lookup:{" "}
      <strong>{districts.length}</strong>.
    </div>
  );
}
