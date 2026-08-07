"use client";

import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { getGoogleLoginUrl } from "@/lib/api";

export default function HomePage() {
  const { user, loading } = useUser();

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <h1 className="text-4xl font-extrabold text-text-primary tracking-[-0.03em]">
          SaaS Boilerplate
        </h1>

        <p className="text-text-secondary mt-4">
          Express + Drizzle + Postgres on the back, Next.js + React Query on the
          front. Google OAuth, rotating refresh tokens, roles, and a versioned
          API are already wired up.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          {loading ? (
            <span className="text-text-muted text-sm">Loading…</span>
          ) : user ? (
            <Link href="/dashboard" className="btn-primary btn-lg">
              Go to dashboard
            </Link>
          ) : (
            <a href={getGoogleLoginUrl()} className="btn-primary btn-lg">
              Sign in with Google
            </a>
          )}
        </div>

        <p className="text-text-muted text-xs mt-8">
          Replace this page with your product.
        </p>
      </div>
    </main>
  );
}
