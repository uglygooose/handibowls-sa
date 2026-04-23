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

// The signUpAction redirects to /me/setup on success, so the "check your
// inbox" success state from the Claude Design preview isn't reachable with
// the current action contract. Left as a drift candidate for a later phase
// that may switch to an explicit email-confirmation flow.
export function SignupForm() {
  const [state, action] = useActionState(signUpAction, initial);
  const [password, setPassword] = useState("");

  return (
    <AuthCard
      kicker="02 · Create account"
      title={
        <>
          Find your{" "}
          <em className="not-italic italic text-primary-500">line.</em>
        </>
      }
      sub="Open an account, join your club, and start scoring by the end of the day."
      foot={
        <>
          Already playing?{" "}
          <Link
            href="/login"
            className="font-semibold text-ink underline underline-offset-[3px] hover:text-primary-500"
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
          />
          <PasswordStrength value={password} />
        </div>
        <Checkbox name="agree" required>
          I agree to the{" "}
          <Link
            href="#"
            className="font-medium text-ink underline underline-offset-[3px] hover:text-primary-500"
          >
            terms
          </Link>{" "}
          and{" "}
          <Link
            href="#"
            className="font-medium text-ink underline underline-offset-[3px] hover:text-primary-500"
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
