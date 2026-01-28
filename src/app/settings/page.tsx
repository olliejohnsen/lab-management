import { AppShell } from "@/components/layout/app-shell";
import { SettingsContent } from "@/components/features/settings-content";
import { requireAdmin } from "@/lib/auth-utils";

export default async function SettingsPage() {
  await requireAdmin();
  
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  );
}
