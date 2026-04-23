"use client";

import { cn } from "@/lib/utils";

// Lightweight 0–4 strength meter. Not a replacement for zxcvbn — this is
// inline visual feedback while the user types. Measures length + character
// class diversity.
export function scorePassword(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^\w\s]/.test(pw)) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

const LABELS = ["Too short", "Weak", "Fair", "Strong", "Excellent"] as const;

export function PasswordStrength({ value }: { value: string }) {
  const s = scorePassword(value);
  const colour = (lvl: number) =>
    s >= lvl
      ? lvl === 1
        ? "bg-danger-500"
        : lvl === 2
          ? "bg-warning-500"
          : lvl === 3
            ? "bg-[#22c55e]"
            : "bg-success-500"
      : "bg-border";

  return (
    <div className="mt-2">
      <div className="grid grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((lvl) => (
          <div
            key={lvl}
            className={cn("h-1 rounded-full transition-colors", colour(lvl))}
          />
        ))}
      </div>
      <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-subtle">
        {LABELS[s]}
      </div>
    </div>
  );
}
