import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { requireAuth } from "@/lib/auth-utils";
import { TerminalWrapper } from "./terminal-wrapper";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50/50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[80px] -z-10 pointer-events-none" />
        
        <Navbar user={session.user} />
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>
      <TerminalWrapper />
    </div>
  );
}
