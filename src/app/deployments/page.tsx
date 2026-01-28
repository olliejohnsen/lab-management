import { AppShell } from "@/components/layout/app-shell";
import { DeploymentsContent } from "@/components/features/deployments-content";

export default async function DeploymentsPage() {
  return (
    <AppShell>
      <DeploymentsContent />
    </AppShell>
  );
}
