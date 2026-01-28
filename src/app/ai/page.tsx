import { AppShell } from "@/components/layout/app-shell";
import { AIAssistantContent } from "@/components/features/ai-assistant-content";

export default async function AIAssistantPage() {
  return (
    <AppShell>
      <AIAssistantContent />
    </AppShell>
  );
}
