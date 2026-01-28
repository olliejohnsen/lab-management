"use client";

import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Bell, Search, Command } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  user: {
    email?: string | null;
    isAdmin: boolean;
  };
}

export function Navbar({ user }: NavbarProps) {
  const initials = user.email
    ?.split("@")[0]
    .substring(0, 2)
    .toUpperCase() || "U";

  return (
    <header className="h-16 border-b bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md hidden sm:block group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search deployments, hosts..." 
            className="pl-10 bg-slate-100/50 border-transparent focus:bg-white focus:border-primary/20 transition-all rounded-xl"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded border bg-white text-[10px] font-medium text-slate-400">
            <Command className="h-2.5 w-2.5" />
            <span>K</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-full text-slate-500 hover:text-primary hover:bg-primary/5">
          <Bell className="h-5 w-5" />
        </Button>

        <div className="h-8 w-[1px] bg-slate-200 mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 p-1 rounded-full hover:bg-slate-100 transition-all outline-none group">
              <Avatar className="h-8 w-8 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-left hidden lg:block pr-2">
                <div className="text-xs font-bold text-slate-900 leading-none mb-1">{user.email?.split('@')[0]}</div>
                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">
                  {user.isAdmin ? "Administrator" : "User"}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 shadow-xl border-slate-200/60">
            <div className="px-2 py-1.5 mb-1 lg:hidden">
              <div className="text-sm font-bold text-slate-900">{user.email}</div>
              <div className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">
                {user.isAdmin ? "Administrator" : "User"}
              </div>
            </div>
            <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
              <a href="/change-password" title="Change Password">
                <User className="mr-2 h-4 w-4 text-slate-500" />
                <span>Account Settings</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1 bg-slate-100" />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg cursor-pointer text-destructive focus:bg-destructive/5 focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
