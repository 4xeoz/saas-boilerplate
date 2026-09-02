import AppLayout from "@/components/layout/AppLayout";
import PairThisMac from "@/components/connectors/PairThisMac";
import { FiArrowUpRight, FiZap } from "react-icons/fi";

export default function UserDashboardPage() {
  return (
    <AppLayout>
      <div className="relative isolate min-h-full overflow-hidden">
        <div className="pointer-events-none absolute right-[-12%] top-[-8%] -z-10 h-96 w-96 rounded-full bg-brand-1/10 blur-3xl" />
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">User space</p>
              <h1 className="mt-3 text-[clamp(38px,6vw,68px)] font-semibold leading-none tracking-[-0.065em] text-text-primary">Your loop.</h1>
              <p className="mt-4 text-base text-text-secondary">Pair a Mac. Keep the work moving.</p>
            </div>
            <a href="#devices" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-brand-2 transition hover:text-brand-2/70 dark:text-brand-1">
              Manage devices <FiArrowUpRight aria-hidden="true" />
            </a>
          </div>

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-brand-1/30 bg-brand-1/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-brand-2 dark:text-brand-1">
            <FiZap aria-hidden="true" />
            Ready to connect
          </div>

          <PairThisMac />
        </div>
      </div>
    </AppLayout>
  );
}
