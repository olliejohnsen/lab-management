"use client";

import { useState, useEffect } from "react";
import { QuickTerminal } from "@/components/features/quick-terminal";
import { useTerminal } from "@/hooks/use-terminal";

export function TerminalWrapper() {
  const { isOpen, close } = useTerminal();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <QuickTerminal isOpen={isOpen} onClose={close} />;
}
