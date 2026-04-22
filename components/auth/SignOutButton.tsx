"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";

import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

type Props = {
  variant?: "light" | "dark";
  className?: string;
};

export function SignOutButton({ variant = "light", className }: Props) {
  const [pending, startTransition] = useTransition();
  const isDark = variant === "dark";

  return (
    <form
      action={() => {
        startTransition(() => {
          void signOutAction();
        });
      }}
    >
      <button
        type="submit"
        aria-label="Sign out"
        disabled={pending}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50",
          isDark
            ? "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            : "text-ink-muted hover:bg-surface-muted hover:text-ink",
          className,
        )}
      >
        <LogOut className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{pending ? "Signing out…" : "Sign out"}</span>
      </button>
    </form>
  );
}
