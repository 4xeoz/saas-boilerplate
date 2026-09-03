"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FiActivity,
  FiArrowUpRight,
  FiBookOpen,
  FiCheckCircle,
  FiCode,
  FiLogOut,
  FiShield,
  FiZap,
} from "react-icons/fi";
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
      <div className="flex min-h-screen items-center justify-center bg-[#08110b] text-[#efffe7]">
        <div className="flex items-center gap-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#b9f57b] shadow-[0_0_14px_#b9f57b]" />
          Opening developer space
        </div>
      </div>
    );
  }

  async function logout() {
    await logoutDeveloper().catch(() => undefined);
    router.replace("/");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#eef7e8] text-[#0e0f0c]">
      <header className="border-b border-white/10 bg-[#08110b] text-[#efffe7] shadow-[0_16px_45px_rgba(7,16,11,0.12)]">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/developer-dashboard" className="flex items-center gap-3 whitespace-nowrap" aria-label="re-entry cloud developer dashboard">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#b9f57b] text-[#163300]">
              <FiCode className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-[17px] font-bold tracking-[-0.04em] text-white">re-entry</span>
            <span className="-ml-2 mt-3 text-[9px] font-bold uppercase tracking-[0.24em] text-[#9fe870]">cloud</span>
            <span className="hidden border-l border-white/15 pl-4 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/42 sm:inline">Developer space</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle className="text-white/65 hover:bg-white/10" iconClassName="text-[#b9f57b]" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void logout()}
              className="!text-white/65 hover:!bg-white/10 hover:!text-white"
            >
              <FiLogOut aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="pointer-events-none absolute -right-32 -top-40 h-[30rem] w-[30rem] rounded-full bg-[#9fe870]/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8fbd83] bg-[#dff3d7] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#286323]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4b9b42] shadow-[0_0_10px_rgba(75,155,66,0.45)]" />
              Developer space / active
            </div>
            <h1 className="mt-6 max-w-2xl text-[clamp(48px,7vw,86px)] font-semibold leading-[0.9] tracking-[-0.075em] text-[#163300]">Build the loop.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-[#587052]">Give agents a clear, human-approved way back.</p>
          </div>

          <div className="flex items-center gap-3 rounded-full border border-[#cddfc8] bg-white/65 px-4 py-2.5 shadow-[0_12px_32px_rgba(22,51,0,0.06)]">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#163300] text-[#b9f57b]">
              <FiActivity className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#4a8e3d]">Signed in</p>
              <p className="max-w-[210px] truncate text-sm font-semibold text-[#163300]">{developer.email}</p>
            </div>
          </div>
        </div>

        <div className="relative mt-10 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <section className="overflow-hidden rounded-[30px] bg-[#163300] p-6 text-[#efffe7] shadow-[0_24px_70px_rgba(22,51,0,0.18)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#b9f57b] text-[#163300]">
                <FiCode className="h-5 w-5" aria-hidden="true" />
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#b9f57b]/25 bg-[#b9f57b]/10 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#b9f57b]">
                <FiCheckCircle aria-hidden="true" />
                Ready
              </span>
            </div>
            <p className="mt-10 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#b9f57b]/70">Integration surface</p>
            <h2 className="mt-3 max-w-xl text-[clamp(28px,4vw,46px)] font-semibold leading-[0.98] tracking-[-0.06em]">Connect your host to the return path.</h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/58">Use the guide to move from manifest to approved continuation.</p>

            <div className="mt-8 grid gap-2 sm:grid-cols-3">
              {[
                { number: "01", label: "Manifest", icon: FiCode },
                { number: "02", label: "Consent", icon: FiShield },
                { number: "03", label: "Return", icon: FiZap },
              ].map(({ number, label, icon: Icon }) => (
                <div key={number} className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[#b9f57b]">{number}</span>
                    <Icon className="h-4 w-4 text-[#8fe5d1]" aria-hidden="true" />
                  </div>
                  <p className="mt-3 font-mono text-[9px] font-bold uppercase tracking-[0.13em] text-white/48">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col justify-between rounded-[30px] border border-[#cddfc8] bg-white/70 p-6 shadow-[0_18px_60px_rgba(22,51,0,0.07)] sm:p-8">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dff3d7] text-[#286323]">
                <FiBookOpen className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-8 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4a8e3d]">Reference</p>
              <h2 className="mt-3 text-3xl font-semibold leading-none tracking-[-0.06em] text-[#163300]">Read the guide.</h2>
              <p className="mt-4 text-sm leading-6 text-[#587052]">Auth, pairing, delivery, and the current contract.</p>
            </div>
            <Link href="/docs" className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-[#163300] px-4 py-2.5 text-sm font-bold text-[#b9f57b] transition hover:bg-[#214d0a]">
              Open docs
              <FiArrowUpRight aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
