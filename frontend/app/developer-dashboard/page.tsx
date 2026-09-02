"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiCode, FiLogOut } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import ThemeToggle from "@/components/ui/ThemeToggle";
import {
  fetchCurrentDeveloper,
  logoutDeveloper,
  type Developer,
} from "@/lib/api/developer-auth";

export default function DeveloperDashboardPage() {
  const router = useRouter();
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchCurrentDeveloper()
      .then((response) => setDeveloper(response.data))
      .catch(() => router.replace("/developer-login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !developer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand-1 border-t-transparent rounded-full" />
      </div>
    );
  }

  async function logout() {
    await logoutDeveloper().catch(() => undefined);
    router.replace("/");
  }

  return (
    <main className="min-h-screen bg-background p-6 sm:p-10">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-extrabold text-text-primary">
            Cloud Receiver 2 / Developers
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="secondary" size="sm" onClick={() => void logout()}>
              <FiLogOut />
              Logout
            </Button>
          </div>
        </header>

        <section className="mt-12 rounded-2xl border border-border bg-surface p-8 shadow-card">
          <FiCode className="h-8 w-8 text-brand-2 dark:text-brand-1" />
          <h1 className="mt-6 text-3xl font-bold text-text-primary">Developer workspace</h1>
          <p className="mt-2 text-text-secondary">Signed in as {developer.email}.</p>
        </section>
      </div>
    </main>
  );
}
