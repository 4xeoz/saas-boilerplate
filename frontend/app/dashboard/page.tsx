'use client';

import AppLayout from "@/components/layout/AppLayout";
import { useUser } from "@/lib/UserContext";

export default function DashboardPage() {
  const { user } = useUser();

  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Welcome back{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="text-text-secondary">Your dashboard is ready. Start building.</p>
      </div>
    </AppLayout>
  );
}
