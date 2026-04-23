"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
};

// Shared auth submit button. Picks up pending state from useFormStatus so
// forms don't each hand-roll the same useTransition glue.
export function SubmitButton({
  children,
  pendingLabel = "Please wait…",
  className,
}: Props) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="xl"
      className={cn("w-full", className)}
      disabled={pending}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
