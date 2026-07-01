"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { FiGrid, FiSettings, FiLogOut, FiBell, FiUser } from "react-icons/fi";

interface NavItemProps {
  href?: string;
  isActive?: boolean;
  icon: React.ElementType;
  title: string;
  onClick?: () => void;
}

function NavItem({ href, isActive, icon: Icon, title, onClick }: NavItemProps) {
  const base = "flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all duration-150 w-full";
  const active = isActive
    ? "bg-brand-1/18 text-brand-1 font-semibold"
    : "text-text-secondary hover:bg-brand-1/10 hover:text-text-primary";

  const content = (
    <>
      <Icon className="w-5 h-5" />
      <span>{title}</span>
    </>
  );

  if (onClick) {
    return <button onClick={onClick} className={`${base} ${active} text-left`}>{content}</button>;
  }

  return <Link href={href || "#"} className={`${base} ${active}`}>{content}</Link>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useUser();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

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
          <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0">
            <Image src="/Tronnium_Main.png" alt="Logo" fill className="object-cover" />
          </div>
          <span className="text-[18px] font-extrabold text-text-primary tracking-[-0.5px]">MyApp</span>
        </Link>

        <nav className="flex-1 flex flex-col gap-1">
          <div className="px-3 pb-2">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.6px]">Main</span>
          </div>

          <NavItem href="/dashboard" icon={FiGrid} title="Dashboard" isActive={pathname === "/dashboard"} />

          <div className="px-3 pt-4 pb-2">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.6px]">Account</span>
          </div>
          <NavItem href="/settings" icon={FiSettings} title="Settings" isActive={pathname === "/settings"} />
          <NavItem href="/notifications" icon={FiBell} title="Notifications" isActive={pathname === "/notifications"} />
        </nav>

        <div className="flex flex-col gap-1 pt-4 border-t border-border">
          <div className="px-3 py-2 flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-text-secondary">Theme</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium text-text-secondary hover:bg-error-bg hover:text-error-text transition-all duration-150 w-full text-left"
          >
            <FiLogOut className="w-5 h-5" />
            Logout
          </button>
          <div className="flex items-center gap-3 px-3 py-3 mt-1">
            <div className="relative w-9 h-9 rounded-full bg-brand-1 flex items-center justify-center overflow-hidden border-2 border-brand-2 shrink-0">
              {user?.avatarUrl ? (
                <Image src={user.avatarUrl} alt={user.name || "User"} fill className="object-cover" />
              ) : (
                <FiUser className="w-4 h-4 text-brand-2" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{user?.name || "User"}</p>
              <p className="text-[11px] text-text-muted truncate">{user?.email || ""}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-background ml-[240px] overflow-auto">
        {children}
      </main>
    </div>
  );
}
