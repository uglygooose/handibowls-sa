import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  kind: "error" | "success";
  children: ReactNode;
  className?: string;
};

// Inline banner used inside AuthCard for form-wide messages.
export function FormBanner({ kind, children, className }: Props) {
  const error = kind === "error";
  const Icon = error ? AlertCircle : CheckCircle2;
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "mb-5 flex items-center gap-2 rounded-[10px] border px-3.5 py-3 text-[13px] font-medium",
        error
          ? "border-danger-500/20 bg-danger-500/8 text-ink"
          : "border-success-500/20 bg-success-500/10 text-ink",
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
