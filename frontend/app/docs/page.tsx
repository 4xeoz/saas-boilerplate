import Link from "next/link";

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-background p-6 sm:p-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-text-secondary hover:text-text-primary">
          ← Cloud Receiver 2
        </Link>
        <h1 className="mt-8 text-3xl font-bold text-text-primary">Preview integration guide</h1>
        <p className="mt-3 text-text-secondary">
          Cloud Receiver 2 is a small preview with separate user and developer sessions.
        </p>

        <div className="mt-8 space-y-6 text-sm leading-6 text-text-secondary">
          <section>
            <h2 className="text-lg font-semibold text-text-primary">User setup</h2>
            <p>
              Create or access a user account at <Link className="text-brand-2 underline" href="/user-register">/user-register</Link> or <Link className="text-brand-2 underline" href="/user-login">/user-login</Link>, then use the user dashboard to request a one-time Mac pairing code.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-text-primary">Developer setup</h2>
            <p>
              Create or access a developer account at <Link className="text-brand-2 underline" href="/developer-register">/developer-register</Link> or <Link className="text-brand-2 underline" href="/developer-login">/developer-login</Link>.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-text-primary">Backend contract</h2>
            <p>
              The backend exposes email/password auth under <code>/v1/auth</code>, pairing and delivery under <code>/v0.1</code>, and health checks at <code>/health</code>, <code>/health/live</code>, and <code>/readyz</code>. Consent pages are served by the backend origin and return the user to the frontend login when authentication is required.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
