"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTerminal } from "@/hooks/use-terminal";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Server, 
  Sparkles, 
  Settings,
  Package,
  ChevronRight,
  Terminal,
  Boxes,
  Layers
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const menuItems = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Overview of your DEV environment"
  },
  {
    name: "Deployments",
    href: "/deployments",
    icon: Package,
    description: "Manage running stacks"
  },
  {
    name: "Templates",
    href: "/templates",
    icon: Layers,
    description: "Predefined stacks to deploy"
  },
  {
    name: "Containers",
    href: "/containers",
    icon: Boxes,
    description: "Host containers & projects"
  },
  {
    name: "AI Assistant",
    href: "/ai",
    icon: Sparkles,
    description: "Generate infrastructure"
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    description: "System configuration"
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { toggle } = useTerminal();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  return (
    <aside className="hidden md:flex md:w-72 md:flex-col bg-slate-950 text-slate-200 border-r border-slate-800/50">
      <div className="flex h-16 items-center px-6 gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
          <Server className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base leading-none tracking-tight text-white">DEV Manager</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">Infrastructure</span>
        </div>
      </div>
      
      <Separator className="bg-slate-800/50 mx-6 w-auto" />

      <ScrollArea className="flex-1 px-4 py-6">
        <div className="space-y-6">
          <div>
            <h2 className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Main Menu
            </h2>
            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 rounded-md p-1.5 transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "bg-slate-900 group-hover:bg-slate-800"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="text-sm font-semibold truncate">{item.name}</div>
                      <div className={cn(
                        "text-[11px] truncate transition-colors",
                        isActive ? "text-primary/70" : "text-slate-500 group-hover:text-slate-400"
                      )}>
                        {item.description}
                      </div>
                    </div>
                    {isActive && <ChevronRight className="h-3 w-3 self-center text-primary opacity-50" />}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div>
            <h2 className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              System
            </h2>
            <div className="px-2 py-3 rounded-xl bg-slate-900/50 border border-slate-800/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-slate-300">System Online</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Nodes</span>
                  <span className="text-slate-300 font-mono">04 Active</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Stacks</span>
                  <span className="text-slate-300 font-mono">12 Running</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-slate-800/50">
        <button 
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900/30 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer group border-none outline-none"
        >
          <Terminal className="h-4 w-4 group-hover:text-primary transition-colors" />
          <span className="text-xs font-medium">Quick Terminal</span>
        </button>
      </div>
    </aside>
  );
}
