"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FiActivity,
  FiBookOpen,
  FiGrid,
  FiLogOut,
  FiMonitor,
} from "react-icons/fi";
import { useUser } from "@/lib/UserContext";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { Logo } from "@/components/ui/Logo";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useUser();
  const isUserDashboard = pathname.startsWith("/user-dashboard");
  const dashboardHref = isUserDashboard ? "/user-dashboard" : "/dashboard";

  useEffect(() => {
    if (!loading && !user) {
      router.replace(isUserDashboard ? "/user-login" : "/login");
    }
  }, [isUserDashboard, loading, router, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08110b] text-[#efffe7]">
        <div className="flex items-center gap-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#b9f57b] shadow-[0_0_14px_#b9f57b]" />
          Opening your loop
        </div>
      </div>
    );
  }

  if (!user) return null;

  const navItems = [
    { href: dashboardHref, label: "Overview", icon: FiGrid, active: pathname === dashboardHref },
    { href: `${dashboardHref}#devices`, label: "Devices", icon: FiMonitor, active: false },
    { href: "/docs", label: "Guide", icon: FiBookOpen, active: false },
  ];

  return (
    <div className="min-h-screen bg-[#eef7e8] text-[#0e0f0c]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08110b]/95 text-[#efffe7] shadow-[0_16px_45px_rgba(7,16,11,0.12)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center gap-4 px-5 sm:px-8">
          <Link href={dashboardHref} className="flex shrink-0 items-center gap-3 whitespace-nowrap" aria-label="re-entry cloud dashboard">
            <Logo className="h-9 w-9" />
            <span className="text-[17px] font-bold tracking-[-0.04em] text-white">re-entry</span>
            <span className="-ml-2 mt-3 text-[9px] font-bold uppercase tracking-[0.24em] text-[#9fe870]">cloud</span>
          </Link>

          <div className="hidden items-center gap-2 border-l border-white/10 pl-5 xl:flex">
            <FiActivity className="h-3.5 w-3.5 text-[#b9f57b]" aria-hidden="true" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/42">Account console</span>
          </div>

          <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-1" aria-label="Dashboard navigation">
            {navItems.map(({ href, label, icon: Icon, active }) => (
              <Link
                key={label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[#b9f57b] text-[#163300] shadow-[0_0_22px_rgba(185,245,123,0.16)]"
                    : "text-white/58 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 lg:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b9f57b] shadow-[0_0_10px_#b9f57b]" aria-hidden="true" />
              <span className="max-w-[170px] truncate text-xs font-semibold text-white/65">{user.email}</span>
            </div>
            <ThemeToggle className="text-white/65 hover:bg-white/10" iconClassName="text-[#b9f57b]" />
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex h-10 items-center gap-2 rounded-full px-2.5 text-sm font-semibold text-white/60 transition hover:bg-[#3a1515] hover:text-[#ffb4ad] sm:px-3"
              aria-label="Log out"
              title="Log out"
            >
              <FiLogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-76px)] overflow-auto">{children}</main>
    </div>
  );
}
