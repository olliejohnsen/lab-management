import { AppShell } from "@/components/layout/app-shell";
import { ContainersContent } from "@/components/features/containers-content";

export default async function ContainersPage() {
  return (
    <AppShell>
      <ContainersContent />
    </AppShell>
  );
}
