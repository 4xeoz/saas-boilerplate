"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FiBookOpen, FiGrid, FiLogOut, FiMonitor, FiUser } from "react-icons/fi";
import { useUser } from "@/lib/UserContext";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { Logo } from "@/components/ui/Logo";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useUser();
  const dashboardHref = pathname.startsWith("/user-dashboard") ? "/user-dashboard" : "/dashboard";

  useEffect(() => {
    if (!loading && !user) {
      router.replace(pathname.startsWith("/user-dashboard") ? "/user-login" : "/login");
    }
  }, [loading, pathname, router, user]);

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand-1 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[74px] max-w-7xl items-center gap-4 px-4 sm:px-7">
          <Link href={dashboardHref} className="flex shrink-0 items-center gap-2.5" aria-label="re-entry cloud dashboard">
            <Logo className="h-9 w-9" />
            <span className="hidden text-[17px] font-bold tracking-[-0.05em] text-text-primary sm:inline">re-entry</span>
            <span className="-ml-2 mt-3 hidden text-[8px] font-bold uppercase tracking-[0.22em] text-brand-2 dark:text-brand-1 sm:inline">cloud</span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Dashboard navigation">
            <Link
              href={dashboardHref}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${
                pathname === dashboardHref
                  ? "bg-brand-1/15 text-brand-2 dark:text-brand-1"
                  : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
              }`}
            >
              <FiGrid className="h-4 w-4" aria-hidden="true" />
              <span>Overview</span>
            </Link>
            <Link
              href={`${dashboardHref}#devices`}
              className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-secondary hover:text-text-primary"
            >
              <FiMonitor className="h-4 w-4" aria-hidden="true" />
              <span>Devices</span>
            </Link>
            <Link
              href="/docs"
              className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-secondary hover:text-text-primary"
            >
              <FiBookOpen className="h-4 w-4" aria-hidden="true" />
              <span>Guide</span>
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <ThemeToggle />
            <div className="hidden items-center gap-2 border-l border-border pl-3 lg:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-1 text-brand-2">
                <FiUser className="h-4 w-4" aria-hidden="true" />
              </div>
              <span className="max-w-[180px] truncate text-xs font-semibold text-text-secondary">{user.email}</span>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex h-10 items-center gap-2 rounded-full px-2.5 text-sm font-semibold text-text-secondary transition hover:bg-error-bg hover:text-error-text sm:px-3"
              aria-label="Log out"
              title="Log out"
            >
              <FiLogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-74px)] overflow-auto bg-background">{children}</main>
    </div>
  );
}
