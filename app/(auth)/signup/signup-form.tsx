"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { signUpAction, type AuthFormState } from "@/lib/auth/actions";

import { AuthCard } from "../_components/AuthCard";
import { Checkbox } from "../_components/Checkbox";
import { Field, PasswordField } from "../_components/Field";
import { FormBanner } from "../_components/FormBanner";
import { PasswordStrength } from "../_components/PasswordStrength";
import { SubmitButton } from "../_components/SubmitButton";

const initial: AuthFormState = {};

export function SignupForm() {
  const [state, action] = useActionState(signUpAction, initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Phase 13 / 13-8 / Batch B / Fix 1 — retain-on-error UX.
  // After a failed submit, the action returns { values: { email } }
  // so the user can see + correct what they typed; password clears
  // on error (security best-practice — never echo plaintext back).
  // Pattern: sentinel-compared setState during render (React-canonical
  // for "reset state when an external trigger changes"). Avoids the
  // useEffect-based setState anti-pattern that react-hooks/set-state-
  // in-effect flags as cascading-render risk.
  const [echoedEmail, setEchoedEmail] = useState<string | undefined>(undefined);
  if (state.values?.email !== echoedEmail) {
    setEchoedEmail(state.values?.email);
    if (state.values?.email !== undefined) setEmail(state.values.email);
  }
  const [errorSeen, setErrorSeen] = useState<string | undefined>(undefined);
  if (state.error !== errorSeen) {
    setErrorSeen(state.error);
    if (state.error) setPassword("");
  }

  return (
    <AuthCard
      kicker="02 · Create account"
      title={
        <>
          Find your{" "}
          <em className="not-italic italic text-accent-ink">line.</em>
        </>
      }
      sub="Open an account, join your club, and start scoring by the end of the day."
      foot={
        <>
          Already playing?{" "}
          <Link
            href="/login"
            className="font-semibold text-ink underline underline-offset-[3px] hover:text-accent-ink"
          >
            Sign in instead
          </Link>
        </>
      }
    >
      <form action={action} className="flex flex-col gap-[18px]" noValidate>
        {state.error && <FormBanner kind="error">{state.error}</FormBanner>}
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field
            label="First name"
            name="first_name"
            type="text"
            autoComplete="given-name"
            required
            placeholder="Nthabi"
          />
          <Field
            label="Last name"
            name="last_name"
            type="text"
            autoComplete="family-name"
            required
            placeholder="Mokoena"
          />
        </div>
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@club.co.za"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          error={state.fieldErrors?.email}
        />
        <div>
          <PasswordField
            label="Password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            error={state.fieldErrors?.password}
          />
          <PasswordStrength value={password} />
        </div>
        <Checkbox name="agree" required>
          I agree to the{" "}
          <Link
            href="/terms"
            className="font-medium text-ink underline underline-offset-[3px] hover:text-accent-ink"
          >
            terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="font-medium text-ink underline underline-offset-[3px] hover:text-accent-ink"
          >
            privacy policy
          </Link>
          .
        </Checkbox>
        <SubmitButton pendingLabel="Creating account…">
          Create account
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
