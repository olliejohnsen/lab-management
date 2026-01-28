import { AppShell } from "@/components/layout/app-shell";
import { NewDeploymentContent } from "@/components/features/new-deployment-content";

export default async function NewDeploymentPage() {
  return (
    <AppShell>
      <NewDeploymentContent />
    </AppShell>
  );
}
