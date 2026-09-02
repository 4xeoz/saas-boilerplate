"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FiGrid, FiLogOut, FiUser } from "react-icons/fi";
import { useUser } from "@/lib/UserContext";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { Logo } from "@/components/ui/Logo";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useUser();

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
    <div className="min-h-screen bg-background flex">
      <aside className="w-[240px] h-screen bg-background-secondary border-r border-border flex flex-col px-3 py-4 fixed top-0 left-0 z-20">
        <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 mb-6">
          <Logo className="w-9 h-9 shrink-0" />
          <span className="text-[18px] font-extrabold text-text-primary tracking-[-0.5px]">Cloud Receiver 2</span>
        </Link>

        <nav className="flex-1">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all w-full ${
              pathname === "/dashboard"
                ? "bg-brand-1/18 text-brand-1 font-semibold"
                : "text-text-secondary hover:bg-brand-1/10 hover:text-text-primary"
            }`}
          >
            <FiGrid className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
        </nav>

        <div className="flex flex-col gap-1 pt-4 border-t border-border">
          <div className="px-3 py-2 flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-text-secondary">Theme</span>
          </div>
          <button
            onClick={() => void logout()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium text-text-secondary hover:bg-error-bg hover:text-error-text transition-all w-full text-left"
          >
            <FiLogOut className="w-5 h-5" />
            Logout
          </button>
          <div className="flex items-center gap-3 px-3 py-3 mt-1">
            <div className="relative w-9 h-9 rounded-full bg-brand-1 flex items-center justify-center overflow-hidden border-2 border-brand-2 shrink-0">
              <FiUser className="w-4 h-4 text-brand-2" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">User</p>
              <p className="text-[11px] text-text-muted truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-background ml-[240px] overflow-auto">{children}</main>
    </div>
  );
}
