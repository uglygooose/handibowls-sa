"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 300;

type Props = {
  initialQuery: string;
  basePath: string;
};

// Phase 12 / 12-7: read-only search bar. Owns the debounced URL push so the
// server-rendered ClubsTable re-fetches with the new q. `useTransition` keeps
// the input responsive while the new RSC payload streams in.
//
// Replaces the pre-12-7 ClubsTable client-side `globalFilter` over the
// paginated subset, which only matched rows on the active page when the
// dataset spanned 2+ pages. Pattern lifted from
// `app/(super-admin)/platform/users/_components/UsersSearchBar.tsx`.

export function ClubsSearchBar({ initialQuery, basePath }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<number | null>(null);

  // Sync local input when the URL changes from elsewhere (back button etc.).
  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  function pushQuery(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.trim()) params.set("q", next.trim());
    else params.delete("q");
    params.delete("page"); // reset to page 1 on a new search
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${basePath}?${qs}` : basePath);
    });
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      pushQuery(next);
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name, short name, or city…"
        aria-label="Search clubs"
        data-testid="clubs-search-input"
        className="max-w-sm"
      />
      <span
        aria-live="polite"
        className="text-xs text-ink-muted tabular-nums min-w-12"
      >
        {isPending ? "Searching…" : ""}
      </span>
    </div>
  );
}
