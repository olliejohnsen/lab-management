"use client";

import { useState, useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { QuickTerminal } from "@/components/features/quick-terminal";
import { useTerminal } from "@/hooks/use-terminal";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </SessionProvider>
  );
}
