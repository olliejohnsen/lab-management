import { AppShell } from "@/components/layout/app-shell";
import { DashboardContent } from "@/components/features/dashboard-content";

export default async function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
