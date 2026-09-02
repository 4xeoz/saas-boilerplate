import AppLayout from "@/components/layout/AppLayout";
import PairThisMac from "@/components/connectors/PairThisMac";

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="max-w-4xl p-8">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-2">Welcome to your user account.</p>
        <PairThisMac />
      </div>
    </AppLayout>
  );
}
