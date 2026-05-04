import Link from "next/link";

// Phase 13 / 13-6 / Batch A — public terms of use. Lean v1 shape:
// minimal acceptable-use, no warranty / liability bombast. Defer
// counsel-reviewed full terms to first paying customer per locked
// decision D3.2.

export const dynamic = "force-static";

export const metadata = {
  title: "Terms of use · HandiBowls",
  description:
    "Acceptable use, account responsibility, and basic terms for using HandiBowls.",
};

const VERSION = "1.0";
const LAST_UPDATED = "2026-05-04";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-5 py-12 text-ink">
      <header className="mb-10 border-b border-border pb-6">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Version {VERSION} · Last updated {LAST_UPDATED}
        </p>
        <h1 className="mt-3 font-display text-[44px] font-black italic leading-[0.95] tracking-tight">
          Terms of use
        </h1>
        <p className="mt-4 text-[16px] leading-[1.55] text-ink-muted">
          The basic rules for using HandiBowls. Lean v1 shape — covers
          account responsibility and acceptable use; a fuller revision
          will land before HandiBowls accepts paying customers.
        </p>
      </header>

      <Section n={1} title="Acceptance">
        <p>
          By creating an account or signing in to HandiBowls (&ldquo;the
          service&rdquo;) you agree to these terms. If you don&apos;t agree,
          don&apos;t use the service.
        </p>
        <p>
          The service is operated by Andrew Els (sole proprietor) trading as
          HandiBowls, based in the Western Cape, Republic of South Africa.
          Contact:{" "}
          <a className={LINK} href="mailto:a.thomas.els@gmail.com">
            a.thomas.els@gmail.com
          </a>
          .
        </p>
      </Section>

      <Section n={2} title="Your account">
        <ul className={UL}>
          <li>
            <strong>One account per person.</strong> Don&apos;t create
            multiple accounts to circumvent club membership rules or
            tournament eligibility.
          </li>
          <li>
            <strong>Accurate information.</strong> Use your real name and
            BSA number. The integrity of competitive bowls depends on
            players being who they say they are.
          </li>
          <li>
            <strong>Password security.</strong> Choose a strong password
            and don&apos;t share it. You&apos;re responsible for activity
            on your account.
          </li>
          <li>
            <strong>Notify us of compromise.</strong> If you believe your
            account has been accessed without your permission, contact{" "}
            <a className={LINK} href="mailto:a.thomas.els@gmail.com">
              a.thomas.els@gmail.com
            </a>{" "}
            promptly.
          </li>
        </ul>
      </Section>

      <Section n={3} title="Acceptable use">
        <p>You agree to use the service only for legitimate bowls activities. Specifically, you won&apos;t:</p>
        <ul className={UL}>
          <li>
            Disrupt or interfere with the service or other users&apos;
            access to it.
          </li>
          <li>
            Impersonate another player, club admin, or HandiBowls staff.
          </li>
          <li>
            Scrape, mass-download, or reverse-engineer the service or its
            data.
          </li>
          <li>
            Submit deliberately false scores, results, or assessments.
          </li>
          <li>
            Send abusive, threatening, harassing, or unlawful content
            through the messaging or profile surfaces.
          </li>
          <li>
            Use the service to violate any applicable South African law
            or the rights of any third party.
          </li>
        </ul>
      </Section>

      <Section n={4} title="Termination">
        <ul className={UL}>
          <li>
            <strong>By you.</strong> You can delete your account at any
            time at{" "}
            <Link className={LINK} href="/me/settings/data-and-privacy">
              /me/settings/data-and-privacy
            </Link>
            . A 30-day grace period applies, during which you can sign in
            and reverse the deletion. After the grace window, your
            personally identifying information is anonymised. See the{" "}
            <Link className={LINK} href="/privacy">
              privacy policy
            </Link>{" "}
            for details.
          </li>
          <li>
            <strong>By us.</strong> We may suspend or terminate accounts
            for breaches of these terms, fraud, or activity that puts
            the service or its users at risk. Where reasonable we&apos;ll
            give notice and a chance to remedy the issue first.
          </li>
        </ul>
      </Section>

      <Section n={5} title="Changes to these terms">
        <p>
          We may update these terms as the service evolves or as legal
          requirements change. Material changes will be communicated via
          email and an in-app notification before they take effect. The
          version number and last-updated date at the top of this page
          show the current revision.
        </p>
      </Section>

      <Section n={6} title="Service is provided as-is">
        <p>
          HandiBowls is provided on an &ldquo;as is&rdquo; basis for v1.
          We work hard to keep the service reliable, accurate, and
          secure, but we don&apos;t make formal warranties beyond those
          required by South African consumer protection law (notably the
          Consumer Protection Act). A counsel-reviewed warranty and
          liability framework will land before HandiBowls accepts paying
          customers.
        </p>
      </Section>

      <Section n={7} title="Governing law and disputes">
        <p>
          These terms are governed by the laws of the Republic of South
          Africa. Any dispute arising under or in connection with these
          terms is subject to the jurisdiction of the courts of the
          Western Cape.
        </p>
        <p>
          Nothing in these terms limits any consumer rights you have
          under the Consumer Protection Act or any other applicable
          South African law.
        </p>
      </Section>

      <Section n={8} title="Contact">
        <p>
          For questions about these terms, contact{" "}
          <a className={LINK} href="mailto:a.thomas.els@gmail.com">
            a.thomas.els@gmail.com
          </a>
          .
        </p>
      </Section>

      <footer className="mt-12 border-t border-border pt-6 text-[13px] text-ink-muted">
        <Link className={LINK} href="/privacy">
          Read our privacy policy
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
