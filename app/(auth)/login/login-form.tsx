"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInAction,
  signInWithMagicLinkAction,
  type AuthFormState,
} from "@/lib/auth/actions";

const initial: AuthFormState = {};

export function LoginForm({
  next,
  initialMagicLinkSent,
}: {
  next: string;
  initialMagicLinkSent: boolean;
}) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [pwState, pwAction] = useActionState(signInAction, initial);
  const [mlState, mlAction] = useActionState(
    signInWithMagicLinkAction,
    initialMagicLinkSent ? { ok: true } : initial,
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist" aria-label="Sign-in method">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "password"}
          onClick={() => setMode("password")}
          className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
            mode === "password"
              ? "border-primary-500 bg-primary-500 text-[color:var(--color-on-primary)]"
              : "border-border bg-surface text-ink-muted hover:text-ink"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "magic"}
          onClick={() => setMode("magic")}
          className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
            mode === "magic"
              ? "border-primary-500 bg-primary-500 text-[color:var(--color-on-primary)]"
              : "border-border bg-surface text-ink-muted hover:text-ink"
          }`}
        >
          Magic link
        </button>
      </div>

      {mode === "password" ? (
        <form action={pwAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {pwState.error && <ErrorMessage>{pwState.error}</ErrorMessage>}
          <SubmitButton>Sign in</SubmitButton>
        </form>
      ) : (
        <form action={mlAction} className="space-y-4">
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          {mlState.error && <ErrorMessage>{mlState.error}</ErrorMessage>}
          {mlState.ok && (
            <p className="rounded-md bg-surface-muted p-3 text-sm text-ink">
              Check your email for a sign-in link.
            </p>
          )}
          <SubmitButton>Send magic link</SubmitButton>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  required,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
      />
    </div>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-danger-500/10 p-3 text-sm text-danger-500">
      {children}
    </p>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Please wait…" : children}
    </Button>
  );
}
