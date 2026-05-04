import Link from "next/link";

// Phase 13 / 13-6 / Batch A — public privacy policy. Lean v1 shape:
// POPIA basics, no template flourish, accurate against the actual
// data flows shipped through 13-2b.
//
// Static Server Component, no client interactivity. Sits under the
// (public) route group's Core Black layout.

export const dynamic = "force-static";

export const metadata = {
  title: "Privacy policy · HandiBowls",
  description:
    "How HandiBowls collects, uses, and protects your personal information under POPIA.",
};

const VERSION = "1.0";
const LAST_UPDATED = "2026-05-04";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-5 py-12 text-ink">
      <header className="mb-10 border-b border-border pb-6">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Version {VERSION} · Last updated {LAST_UPDATED}
        </p>
        <h1 className="mt-3 font-display text-[44px] font-black italic leading-[0.95] tracking-tight">
          Privacy policy
        </h1>
        <p className="mt-4 text-[16px] leading-[1.55] text-ink-muted">
          This policy explains what data HandiBowls collects, how it&apos;s
          used, and the rights you have over it under South Africa&apos;s
          Protection of Personal Information Act (POPIA).
        </p>
      </header>

      <Section n={1} title="Who we are">
        <p>
          HandiBowls is a trading name operated by Andrew Els (sole proprietor),
          based in the Western Cape, Republic of South Africa.
        </p>
        <p>
          For privacy questions or to exercise any of the rights below, contact{" "}
          <a className={LINK} href="mailto:a.thomas.els@gmail.com">
            a.thomas.els@gmail.com
          </a>
          .
        </p>
      </Section>

      <Section n={2} title="What we collect">
        <p>To run the service, we collect and store:</p>
        <ul className={UL}>
          <li>
            <strong>Profile information</strong> — name, BSA number, gender,
            date of birth, dominant hand, contact details (email, phone), club
            grading, and the email-opt-in preference you set during sign-up.
          </li>
          <li>
            <strong>Club memberships</strong> — which clubs you belong to and
            in what role (player, club admin).
          </li>
          <li>
            <strong>Tournament and match data</strong> — entries you submit,
            team rosters, match scores, end-by-end records, win/loss outcomes.
          </li>
          <li>
            <strong>Bookings</strong> — rink reservations you make through the
            app (date, time, rink, party size, purpose).
          </li>
          <li>
            <strong>Twenty 20 assessments</strong> — delivery-by-delivery shot
            outcomes, grade results, optional coach notes recorded by your
            club admin.
          </li>
          <li>
            <strong>Messages and notifications</strong> — content you send to
            other club members through the in-app messaging surface, plus
            notification reads/dismissals.
          </li>
          <li>
            <strong>Account security data</strong> — authentication tokens
            and session metadata, managed for us by our authentication
            provider (see Section 5).
          </li>
          <li>
            <strong>Audit log</strong> — system-recorded events for actions
            your club admin or our staff take that affect your account
            (cancellations, role changes, account deletions). Used for
            compliance and dispute resolution.
          </li>
        </ul>
      </Section>

      <Section n={3} title="Why we collect it (lawful basis)">
        <ul className={UL}>
          <li>
            <strong>Performance of contract</strong> — most data is collected
            to operate your account and the service you signed up for.
          </li>
          <li>
            <strong>Consent</strong> — Twenty 20 assessment participation,
            email opt-in, and any future marketing communications. You can
            withdraw consent at any time.
          </li>
          <li>
            <strong>Legitimate interest</strong> — tournament administration,
            anti-fraud, and protecting the integrity of competitive results.
          </li>
        </ul>
      </Section>

      <Section n={4} title="How we use it">
        <ul className={UL}>
          <li>To run your account, club memberships, and tournament entries.</li>
          <li>To record and display match scores and Twenty 20 results.</li>
          <li>To deliver invitations, notifications, and admin messages.</li>
          <li>
            To improve the service through aggregated, anonymised usage
            patterns (no individual profiling).
          </li>
        </ul>
        <p>
          We do not sell your personal data. We do not use it for advertising
          targeting. We do not share it with third parties for their own
          marketing.
        </p>
      </Section>

      <Section n={5} title="Third-party processors">
        <p>
          We use a small number of vetted service providers to operate the
          platform. Each is contracted to process data only on our
          instructions:
        </p>
        <ul className={UL}>
          <li>
            <strong>Supabase</strong> — database, authentication, and storage.
            Hosted in the operator&apos;s chosen Supabase region.
          </li>
          <li>
            <strong>Vercel</strong> — application hosting and content delivery,
            globally distributed via Vercel&apos;s edge network.
          </li>
          <li>
            <strong>Resend</strong> — transactional email delivery (invitations,
            notifications). Hosted by Resend&apos;s infrastructure.
          </li>
          <li>
            <strong>Sentry</strong> — error monitoring and crash reporting.
            Hosted in the European Union (Frankfurt, Germany). Personally
            identifying request data is stripped before reaching Sentry; only
            an opaque user identifier is attached so we can correlate errors
            for triage.
          </li>
        </ul>
      </Section>

      <Section n={6} title="How long we keep it">
        <ul className={UL}>
          <li>
            <strong>Active accounts</strong> — for as long as your account is
            active.
          </li>
          <li>
            <strong>Account deletion</strong> — when you delete your account,
            we apply a 30-day grace period during which you can sign in and
            cancel the deletion. After the grace window, your personal
            identifying information (name, contact details, BSA number,
            date of birth) is anonymised. Tournament and match records that
            reference your participation are retained with your name replaced
            by &ldquo;Deleted player&rdquo; — this preserves the integrity of
            historical competitive results for other players.
          </li>
          <li>
            <strong>Audit log</strong> — operational entries (logins,
            cancellations, similar) are retained 30 days. Compliance and
            financial entries (account deletions, admin overrides, role
            changes) are retained 7 years.
          </li>
        </ul>
      </Section>

      <Section n={7} title="Your rights under POPIA">
        <p>You have the right to:</p>
        <ul className={UL}>
          <li>
            <strong>Access</strong> — request a copy of the personal information
            we hold about you. Available immediately at{" "}
            <Link className={LINK} href="/me/settings/data-and-privacy">
              /me/settings/data-and-privacy
            </Link>{" "}
            (sign in required).
          </li>
          <li>
            <strong>Correct</strong> — update inaccurate information directly
            via your profile.
          </li>
          <li>
            <strong>Delete</strong> — request deletion of your account.
            Available at the same settings surface as Access.
          </li>
          <li>
            <strong>Object</strong> — object to specific processing (e.g.
            withdraw email consent) via your profile preferences or by
            contacting us.
          </li>
          <li>
            <strong>Lodge a complaint</strong> — with the Information
            Regulator of South Africa if you believe your rights have been
            infringed. Contact details:{" "}
            <a
              className={LINK}
              href="https://inforegulator.org.za"
              target="_blank"
              rel="noopener noreferrer"
            >
              inforegulator.org.za
            </a>
            .
          </li>
        </ul>
        <p>
          For any of the above, contact{" "}
          <a className={LINK} href="mailto:a.thomas.els@gmail.com">
            a.thomas.els@gmail.com
          </a>
          .
        </p>
      </Section>

      <Section n={8} title="Cookies and similar technologies">
        <p>HandiBowls uses first-party cookies only:</p>
        <ul className={UL}>
          <li>
            <strong>Authentication session cookie</strong> — strictly necessary
            to keep you signed in. Set and managed by our authentication
            provider (Supabase). Cleared when you sign out or when the session
            expires.
          </li>
          <li>
            <strong>Theme preference</strong> — your selected club theme.
            Optional; can be cleared from your browser at any time.
          </li>
        </ul>
        <p>
          We do not set third-party cookies, advertising cookies, or analytics
          tracking cookies. Because all cookies we use are strictly necessary
          for service operation or are explicit user preferences, no separate
          consent banner is shown.
        </p>
      </Section>

      <Section n={9} title="Security">
        <p>We protect your data through:</p>
        <ul className={UL}>
          <li>HTTPS/TLS encryption for all data in transit.</li>
          <li>
            Encryption at rest, managed by our database and storage provider.
          </li>
          <li>
            Row-level security in the database — each query is scoped to what
            the signed-in user is allowed to see.
          </li>
          <li>
            Audit logging of administrative actions for accountability.
          </li>
          <li>
            Error monitoring with PII scrubbing — no email addresses, IP
            addresses, or request bodies are sent to our error-tracking
            provider.
          </li>
        </ul>
      </Section>

      <Section n={10} title="Cross-border data transfers">
        <p>
          Some of our service providers store or process data outside South
          Africa (notably the European Union for Sentry; the operator&apos;s
          configured region for Supabase, Vercel, and Resend). POPIA permits
          this where the recipient jurisdiction provides comparable
          protection or the provider is bound by a data processing agreement
          enforcing equivalent safeguards. All four providers are contracted
          on those terms.
        </p>
      </Section>

      <Section n={11} title="Children's privacy">
        <p>
          HandiBowls is intended for bowls players, which in practice means
          users aged roughly 16 and above. We do not knowingly collect data
          from children under 13. If you are a parent or guardian and believe
          your child has provided personal information to us, contact{" "}
          <a className={LINK} href="mailto:a.thomas.els@gmail.com">
            a.thomas.els@gmail.com
          </a>{" "}
          and we will delete the relevant records.
        </p>
      </Section>

      <Section n={12} title="Changes to this policy">
        <p>
          We may update this policy as the service evolves or as legal
          requirements change. Material changes will be communicated via
          email and an in-app notification before they take effect. The
          version number and last-updated date at the top of this page show
          the current revision.
        </p>
      </Section>

      <Section n={13} title="Contact">
        <p>
          For privacy questions, data subject requests, or any concerns about
          how your information is handled, contact:
        </p>
        <p>
          <strong>HandiBowls</strong>
          <br />
          Andrew Els (sole proprietor)
          <br />
          Western Cape, Republic of South Africa
          <br />
          <a className={LINK} href="mailto:a.thomas.els@gmail.com">
            a.thomas.els@gmail.com
          </a>
        </p>
      </Section>

      <footer className="mt-12 border-t border-border pt-6 text-[13px] text-ink-muted">
        <Link className={LINK} href="/terms">
          Read our terms of use
        </Link>
      </footer>
    </article>
  );
}

const LINK =
  "font-medium text-ink underline underline-offset-[3px] decoration-border hover:decoration-ink";

const UL = "ml-5 mt-2 flex list-disc flex-col gap-2 text-[15px] leading-[1.6]";

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 flex flex-col gap-3 text-[15px] leading-[1.6]">
      <h2 className="font-display text-[24px] font-extrabold italic tracking-tight">
        <span className="mr-2 font-mono text-[14px] font-bold not-italic tracking-[0.08em] text-ink-muted">
          {String(n).padStart(2, "0")}
        </span>
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
