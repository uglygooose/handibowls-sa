"use client";

import * as React from "react";
import type { ReactNode } from "react";

import { Checkbox as ShadcnCheckbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

// Phase 12 / 12-6: swapped from a hand-rolled `peer-checked:[&>svg]:opacity-100`
// arbitrary-variant component to the shadcn Checkbox primitive (Radix
// Checkbox under the hood). The visual contract — 2px black border
// square that fills primary-500 with a white tick when checked — is
// preserved via className overrides; the form-submit semantics are
// unchanged (Radix renders a hidden form-associated input, so `name` /
// `required` / `defaultChecked` work as before).
//
// Used on the remember-me row (login), terms row (signup), and
// code-of-conduct row (invite). All three forms are Client Components;
// the "use client" directive here matches the shadcn primitive.

type ShadcnProps = React.ComponentProps<typeof ShadcnCheckbox>;

type Props = Omit<ShadcnProps, "children"> & {
  children: ReactNode;
  error?: boolean;
};

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof ShadcnCheckbox>,
  Props
>(function Checkbox({ children, error, className, ...props }, ref) {
  return (
    <label className="relative flex cursor-pointer items-start gap-2.5 text-sm text-ink-muted">
      <ShadcnCheckbox
        ref={ref}
        className={cn(
          "mt-0.5 size-5 shrink-0 rounded-[5px] border-2 border-ink bg-bone",
          "data-checked:border-primary-500 data-checked:bg-primary-500 data-checked:text-on-primary",
          "focus-visible:ring-[3px] focus-visible:ring-primary-500/30",
          error && "border-danger-500",
          className,
        )}
        {...props}
      />
      <span>{children}</span>
    </label>
  );
});
