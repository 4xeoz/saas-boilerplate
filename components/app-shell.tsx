"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { BarChart3, Briefcase, CreditCard, FileUp, LayoutDashboard, LogOut, Settings, Users } from "lucide-react";
import { logout } from "@/actions/auth";
import { Brand } from "@/components/brand";

const links = [
  { href: "/app/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/app/projects", label: "Projects", icon: Briefcase },
  { href: "/app/files", label: "Files", icon: FileUp },
  { href: "/app/team", label: "Team", icon: Users },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: { name?: string | null; email?: string | null; role?: string } }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const current = links.find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`));

  function signOut() {
    startTransition(async () => {
      await logout();
      window.location.assign("/");
    });
  }

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <Brand />
        <nav className="app-nav" aria-label="Workspace navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={current?.href === href ? "active" : undefined}>
              <Icon size={17} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="app-user">
          <strong>{user.name || "Workspace member"}</strong>
          <span>{user.email}</span>
          <span style={{ marginTop: 9, color: "var(--accent-dark)", fontWeight: 700 }}>{user.role || "MEMBER"}</span>
          <button className="button button-quiet" style={{ width: "100%", marginTop: 12, minHeight: 36, fontSize: 12 }} onClick={signOut} disabled={pending}>
            <LogOut size={14} aria-hidden="true" /> {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>{current?.label || "Workspace"}</p>
            <h1>{process.env.NEXT_PUBLIC_APP_NAME || "Northstar"}</h1>
          </div>
          <div className="stack-actions">
            <Link href="/" className="button button-quiet">View site</Link>
            <Link href="/app/projects/new" className="button button-primary">New project</Link>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
