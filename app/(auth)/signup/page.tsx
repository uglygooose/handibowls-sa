import Link from "next/link";

import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Create account
        </h1>
        <p className="text-sm text-ink-muted">
          Sign up with email and password. You&apos;ll finish setting up your profile after.
        </p>
      </div>

      <SignupForm />

      <p className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary-500 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
