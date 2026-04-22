import Link from "next/link";

import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; sent?: string }>;
}) {
  const { next, sent } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Sign in
        </h1>
        <p className="text-sm text-ink-muted">
          Welcome back. Enter your email and password to continue.
        </p>
      </div>

      <LoginForm next={next ?? ""} initialMagicLinkSent={sent === "1"} />

      <p className="text-center text-sm text-ink-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-primary-500 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
