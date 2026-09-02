"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-extrabold text-text-primary tracking-[-0.03em]">
          Cloud Receiver 2
        </h1>

        <p className="text-text-secondary mt-4 max-w-xl">
          A small email-and-password foundation with separate user and developer accounts.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link href="/user-login" className="rounded-2xl border border-border bg-surface p-6 transition hover:border-brand-1">
            <h2 className="text-lg font-bold text-text-primary">User account</h2>
            <p className="mt-2 text-sm text-text-secondary">Sign in or create a user account.</p>
          </Link>
          <Link href="/developer-login" className="rounded-2xl border border-border bg-surface p-6 transition hover:border-brand-1">
            <h2 className="text-lg font-bold text-text-primary">Developer account</h2>
            <p className="mt-2 text-sm text-text-secondary">Sign in or create a developer account.</p>
          </Link>
        </div>

        <p className="text-text-muted text-xs mt-8">
          Email/password only. No Google OAuth, roles, or refresh-token flow.
        </p>
      </div>
    </main>
  );
}
