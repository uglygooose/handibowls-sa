"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  signInAction,
  signInWithMagicLinkAction,
  type AuthFormState,
} from "@/lib/auth/actions";

import { AuthCard } from "../_components/AuthCard";
import { Checkbox } from "../_components/Checkbox";
import { Field, PasswordField } from "../_components/Field";
import { FormBanner } from "../_components/FormBanner";
import { SubmitButton } from "../_components/SubmitButton";

const initial: AuthFormState = {};

type Props = {
  next: string;
  initialMagicLinkSent: boolean;
};

export function LoginForm({ next, initialMagicLinkSent }: Props) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [pwState, pwAction] = useActionState(signInAction, initial);
  const [mlState, mlAction] = useActionState(
    signInWithMagicLinkAction,
    initialMagicLinkSent ? { ok: true } : initial,
  );

  return (
    <AuthCard
      kicker="01 · Sign in"
      title={
        <>
          Welcome back{" "}
          <em className="not-italic italic text-accent-ink">skip.</em>
        </>
      }
      sub="Enter your email and password, or send yourself a one-time magic link."
      foot={
        <>
          New to HandiBowls?{" "}
          <Link
            href="/signup"
            className="font-semibold text-ink underline underline-offset-[3px] hover:text-accent-ink"
          >
            Create an account
          </Link>
        </>
      }
    >
      {mode === "password" ? (
        <form action={pwAction} className="flex flex-col gap-[18px]" noValidate>
          <input type="hidden" name="next" value={next} />
          {pwState.error && (
            <FormBanner kind="error">{pwState.error}</FormBanner>
          )}
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@club.co.za"
          />
          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
          <div className="-mt-1 flex items-center justify-between text-[13px]">
            <Checkbox name="remember" defaultChecked>
              Remember me on this device
            </Checkbox>
            <button
              type="button"
              onClick={() => setMode("magic")}
              className="font-medium text-ink underline-offset-[3px] hover:text-accent-ink hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
          <div className="my-1 flex items-center gap-3 before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
            <span className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase text-ink-subtle">
              or
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMode("magic")}
            className="inline-flex h-11 items-center justify-center rounded-[10px] border-2 border-ink bg-transparent px-4 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-ink-inverse"
          >
            Use a magic link instead
          </button>
        </form>
      ) : (
        <form action={mlAction} className="flex flex-col gap-[18px]" noValidate>
          {mlState.error && (
            <FormBanner kind="error">{mlState.error}</FormBanner>
          )}
          {mlState.ok && (
            <FormBanner kind="success">
              Check your email for a sign-in link.
            </FormBanner>
          )}
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@club.co.za"
            hint="We'll send a one-time link. No password needed."
          />
          <SubmitButton pendingLabel="Sending…">Send magic link</SubmitButton>
          <button
            type="button"
            onClick={() => setMode("password")}
            className="mt-2 text-center text-[13px] text-ink-muted hover:text-ink"
          >
            ← Back to password
          </button>
        </form>
      )}
    </AuthCard>
  );
}
