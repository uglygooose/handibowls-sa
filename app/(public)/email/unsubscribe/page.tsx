import { redirect } from "next/navigation";

import { unsubscribeFromEmails } from "@/lib/email/actions";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

// Phase 11 / 11-1c — POPIA unsubscribe page.
//
// Public Server Component. The HMAC token on `?t=` is the auth —
// the user is almost certainly not signed in (they clicked from
// an external inbox). Page flow:
//
//   1. Initial load (no `?status`) — verify the token. On valid,
//      look up the profile email + club name to render a personal
//      confirmation: "Unsubscribe <email> from <club> broadcasts?".
//      On invalid, render a generic "link expired or invalid"
//      card without leaking which.
//   2. Form submit — `<form action={...}>` posts to a colocated
//      Server Action that calls `unsubscribeFromEmails(token)` and
//      redirects to `?status=ok` / `?status=already` / `?status=error`.
//   3. Post-action — the corresponding `?status` branch renders.
//
// The success and "already" branches use the same green visual
// treatment. The error branch is muted-grey, deliberately
// non-alarming (POPIA gives the user the right to retry with a
// fresh link from the next email they receive).

export const metadata = {
  title: "Unsubscribe — HandiBowls",
};

type SearchParams = {
  t?: string;
  status?: "ok" | "already" | "error";
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const status = params.status;
  const token = params.t ?? "";

  if (status === "ok" || status === "already") {
    return <ConfirmationCard variant="success" already={status === "already"} />;
  }
  if (status === "error") {
    return <ConfirmationCard variant="error" />;
  }

  // Initial render — verify token + render the consent form, or
  // render the generic invalid-link card.
  const verified = await verifyUnsubscribeToken(token);
  if (!verified) {
    return <ConfirmationCard variant="invalid" />;
  }

  const supabase = createServiceClient();
  const [{ data: profile }, { data: club }] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, email_opt_in")
      .eq("id", verified.profileId)
      .maybeSingle(),
    verified.clubId
      ? supabase
          .from("clubs")
          .select("name")
          .eq("id", verified.clubId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!profile) {
    // Profile vanished between sign and verify — treat as invalid
    // so we don't leak existence info.
    return <ConfirmationCard variant="invalid" />;
  }

  if (profile.email_opt_in === false) {
    return <ConfirmationCard variant="success" already />;
  }

  return (
    <ConsentForm
      token={token}
      email={profile.email}
      clubName={club?.name ?? null}
    />
  );
}

// ---------------------------------------------------------------------
// Form — Server Action posts to the action surface and redirects
// ---------------------------------------------------------------------

async function submitUnsubscribe(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const result = await unsubscribeFromEmails(token);
  if (result.ok) {
    redirect("/email/unsubscribe?status=ok");
  }
  if (result.kind === "already_unsubscribed") {
    redirect("/email/unsubscribe?status=already");
  }
  redirect("/email/unsubscribe?status=error");
}

function ConsentForm({
  token,
  email,
  clubName,
}: {
  token: string;
  email: string | null;
  clubName: string | null;
}) {
  const recipient = email ?? "this account";
  const scope = clubName ?? "HandiBowls";
  return (
    <Shell>
      <header>
        <span style={STYLES.kicker}>POPIA · Email preferences</span>
        <h1 style={STYLES.heading}>Unsubscribe?</h1>
      </header>
      <p style={STYLES.body}>
        We&rsquo;ll stop sending email to <strong>{recipient}</strong> from{" "}
        <strong>{scope}</strong>. You&rsquo;ll still see in-app messages and
        notifications when you&rsquo;re signed in.
      </p>
      <form action={submitUnsubscribe}>
        <input type="hidden" name="token" value={token} />
        <button type="submit" data-slot="unsubscribe-submit" style={STYLES.cta}>
          Confirm unsubscribe
        </button>
      </form>
      <p style={STYLES.fineprint}>
        Changed your mind? Just close this tab — nothing changes until you tap
        the button above.
      </p>
    </Shell>
  );
}

function ConfirmationCard({
  variant,
  already = false,
}: {
  variant: "success" | "invalid" | "error";
  already?: boolean;
}) {
  if (variant === "success") {
    return (
      <Shell>
        <span style={STYLES.kicker}>POPIA · Email preferences</span>
        <h1 style={STYLES.heading}>
          {already ? "Already unsubscribed." : "You&rsquo;re unsubscribed."}
        </h1>
        <p style={STYLES.body}>
          {already
            ? "This email address was already opted out of HandiBowls emails. Nothing changed."
            : "We won&rsquo;t send any more email to this address. In-app messages and notifications still work when you&rsquo;re signed in."}
        </p>
        <p style={STYLES.fineprint}>
          Want emails again? Update your profile settings inside HandiBowls
          once you&rsquo;re signed in.
        </p>
      </Shell>
    );
  }

  if (variant === "invalid") {
    return (
      <Shell>
        <span style={STYLES.kicker}>POPIA · Email preferences</span>
        <h1 style={STYLES.heading}>Link expired or invalid.</h1>
        <p style={STYLES.body}>
          This unsubscribe link is no longer valid. Open the most recent
          HandiBowls email you received and click the unsubscribe link there
          for a fresh link.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <span style={STYLES.kicker}>POPIA · Email preferences</span>
      <h1 style={STYLES.heading}>Something went wrong.</h1>
      <p style={STYLES.body}>
        We couldn&rsquo;t process your unsubscribe request. Please try again
        in a few minutes, or click the unsubscribe link in the next email you
        receive from HandiBowls.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div data-slot="unsubscribe-page" style={STYLES.page}>
      <div style={STYLES.card}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Inline styles — Core Black, platform chrome
// ---------------------------------------------------------------------

const STYLES = {
  page: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 16px",
    backgroundColor: "#fafaf7",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Arial, sans-serif",
    color: "#0a0a0a",
  } as const,
  card: {
    width: "100%",
    maxWidth: "520px",
    backgroundColor: "#ffffff",
    border: "1px solid #e5e5e2",
    borderRadius: "16px",
    padding: "32px 28px 28px 28px",
    boxShadow: "0 1px 2px rgba(10,10,10,0.04)",
  } as const,
  kicker: {
    display: "inline-block",
    fontFamily:
      "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    color: "#7a7a7a",
    marginBottom: "12px",
  },
  heading: {
    fontFamily:
      "'Barlow Condensed', 'Oswald', Arial Black, Impact, sans-serif",
    fontSize: "36px",
    fontWeight: 900,
    fontStyle: "italic" as const,
    lineHeight: 1.05,
    letterSpacing: "-0.02em",
    margin: "0 0 16px 0",
  },
  body: {
    fontSize: "15px",
    lineHeight: 1.55,
    margin: "0 0 20px 0",
  } as const,
  cta: {
    backgroundColor: "#0a0a0a",
    color: "#ffffff",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    padding: "14px 24px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    width: "100%",
  } as const,
  fineprint: {
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#7a7a7a",
    margin: "16px 0 0 0",
  } as const,
} as const;
