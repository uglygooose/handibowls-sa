"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInviteAction, type AuthFormState } from "@/lib/auth/actions";

const initial: AuthFormState = {};

export function InviteForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(acceptInviteAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} readOnly disabled />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Set password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-ink-subtle">At least 8 characters.</p>
      </div>

      {state.error && (
        <p className="rounded-md bg-danger-500/10 p-3 text-sm text-danger-500">
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Accepting invite…" : "Accept invite"}
    </Button>
  );
}
