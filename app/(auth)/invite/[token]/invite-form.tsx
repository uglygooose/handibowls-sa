"use client";

import { useActionState, useState } from "react";

import { acceptInviteAction, type AuthFormState } from "@/lib/auth/actions";

import { Checkbox } from "../../_components/Checkbox";
import { Field, PasswordField } from "../../_components/Field";
import { FormBanner } from "../../_components/FormBanner";
import { PasswordStrength } from "../../_components/PasswordStrength";
import { SubmitButton } from "../../_components/SubmitButton";

const initial: AuthFormState = {};

type Props = {
  token: string;
  email: string;
};

export function InviteForm({ token, email }: Props) {
  const [state, action] = useActionState(acceptInviteAction, initial);
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="flex flex-col gap-[18px]" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error && <FormBanner kind="error">{state.error}</FormBanner>}
      <Field
        label="Email"
        name="email"
        type="email"
        value={email}
        readOnly
        disabled
      />
      <div>
        <PasswordField
          label="Set a password"
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
        I agree to the club&apos;s code of conduct and HandiBowls&apos; terms.
      </Checkbox>
      <SubmitButton pendingLabel="Joining the club…">Accept invite</SubmitButton>
    </form>
  );
}
