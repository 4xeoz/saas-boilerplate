import AppLayout from "@/components/layout/AppLayout";

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-2">Welcome to your user account.</p>
      </div>
    </AppLayout>
  );
}
