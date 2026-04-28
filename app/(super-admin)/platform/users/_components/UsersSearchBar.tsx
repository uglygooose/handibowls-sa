"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 300;

type Props = {
  initialQuery: string;
  basePath: string;
};

// Read-only search bar. Owns the debounced URL push so the server-rendered
// table re-fetches with the new q. `useTransition` keeps the input responsive
// while the new RSC payload streams in.
export function UsersSearchBar({ initialQuery, basePath }: Props) {
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
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-5 top-1/2 size-[22px] -translate-y-1/2 text-ink-subtle"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search users by name, email, BSA number, or club…"
        aria-label="Search users"
        data-testid="users-search-input"
        className="h-16 rounded-[12px] border-[1.5px] border-border bg-bone pl-14 text-[17px] focus-visible:border-primary-500"
      />
      {isPending && (
        <Loader2
          aria-label="Searching"
          className="absolute right-5 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-subtle"
        />
      )}
    </div>
  );
}
