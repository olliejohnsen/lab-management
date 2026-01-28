"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { 
  X, 
  Terminal as TerminalIcon, 
  Maximize2, 
  Minimize2, 
  ChevronDown, 
  Server,
  AlertCircle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Host {
  id: string;
  name: string;
  host: string;
  connectionType: string;
  isActive: boolean;
}

interface QuickTerminalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickTerminal({ isOpen, onClose }: QuickTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  
  const [hosts, setHosts] = useState<Host[]>([]);
  const [selectedHostId, setSelectedHostId] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error" | "closed">("idle");
  const [error, setError] = useState<string>("");
  const [isMaximized, setIsMaximized] = useState(false);

  // Fetch hosts on mount
  useEffect(() => {
    fetch("/api/hosts")
      .then(res => res.json())
      .then(data => {
        const sshHosts = data.filter((h: Host) => h.connectionType === "SSH" && h.isActive);
        setHosts(sshHosts);
        if (sshHosts.length > 0 && !selectedHostId) {
          setSelectedHostId(sshHosts[0].id);
        }
      })
      .catch(err => console.error("Failed to fetch hosts:", err));
  }, [selectedHostId]);

  const connectTerminal = useCallback((hostId: string) => {
    if (!hostId) return;

    // Cleanup existing session
    if (socketRef.current) {
      socketRef.current.close();
    }
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.reset();
    }

    setStatus("connecting");
    setError("");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Use the same host as the web app, but port 3001 for WebSockets
    const socket = new WebSocket(`${protocol}//${window.location.hostname}:3001`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "terminal_init", hostId }));
    };

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      console.log("[terminal] received payload:", payload.type);
      
      if (payload.type === "terminal_ready") {
        setStatus("connected");
        xtermRef.current?.focus();
        // Initial resize
        if (fitAddonRef.current) {
          const dims = fitAddonRef.current.proposeDimensions();
          if (dims) {
            socket.send(JSON.stringify({ 
              type: "terminal_resize", 
              cols: dims.cols, 
              rows: dims.rows 
            }));
          }
        }
      } else if (payload.type === "terminal_data") {
        xtermRef.current?.write(payload.data);
      } else if (payload.type === "terminal_error") {
        setStatus("error");
        setError(payload.message);
      } else if (payload.type === "terminal_closed") {
        setStatus("closed");
      }
    };

    socket.onclose = (event) => {
      console.log("[terminal] socket closed:", event.code, event.reason);
      setStatus("closed");
    };

    socket.onerror = () => {
      setStatus("error");
      setError("WebSocket connection failed");
    };
  }, []);

  // Initialize xterm
  useEffect(() => {
    if (!isOpen || !terminalRef.current || xtermRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: {
        background: '#020617', // slate-950
        foreground: '#e2e8f0', // slate-200
        cursor: '#3b82f6',     // blue-500
        black: '#020617',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#e2e8f0',
      },
      allowProposedApi: true
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    try {
      term.loadAddon(new WebglAddon());
    } catch (e) {
      console.warn("WebGL addon failed to load:", e);
    }

    term.open(terminalRef.current);
    fitAddon.fit();

    term.onData(data => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "terminal_input", data }));
      }
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ 
          type: "terminal_resize", 
          cols: dims.cols, 
          rows: dims.rows 
        }));
      }
    };

    window.addEventListener("resize", handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      term.dispose();
      xtermRef.current = null;
    };
  }, [isOpen, onClose]);

  // Re-fit when maximized/restored or host changed
  useEffect(() => {
    if (fitAddonRef.current && status === "connected") {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        const dims = fitAddonRef.current?.proposeDimensions();
        if (dims && socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ 
            type: "terminal_resize", 
            cols: dims.cols, 
            rows: dims.rows 
          }));
        }
      }, 300);
    }
  }, [isMaximized, status]);

  const handleHostChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHostId = e.target.value;
    setSelectedHostId(newHostId);
    if (newHostId) {
      connectTerminal(newHostId);
    }
  };

  const selectedHost = hosts.find(h => h.id === selectedHostId);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999 }}
          className={cn(
            "bg-slate-950 border-t border-slate-800 shadow-2xl flex flex-col transition-all duration-300",
            isMaximized ? "top-0 h-auto" : "h-[45vh]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-300">
                <TerminalIcon className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider">Quick Terminal</span>
              </div>
              
              <div className="h-4 w-[1px] bg-slate-800 mx-1" />
              
              <div className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-slate-500" />
                <select 
                  value={selectedHostId}
                  onChange={handleHostChange}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-bold py-1 px-2 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="" disabled>Select Host</option>
                  {hosts.map(h => (
                    <option key={h.id} value={h.id}>{h.name} ({h.host})</option>
                  ))}
                  {hosts.length === 0 && <option value="" disabled>No active SSH hosts</option>}
                </select>
                
                <Badge status={status} />
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md"
                onClick={() => connectTerminal(selectedHostId)}
                title="Reconnect"
              >
                <Loader2 className={cn("h-4 w-4", status === "connecting" && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md"
                onClick={() => setIsMaximized(!isMaximized)}
              >
                {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-rose-500/20 rounded-md"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Main Terminal Area */}
          <div className="flex-1 relative overflow-hidden bg-[#020617]">
            {status === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 text-slate-500 bg-slate-950/50 z-10">
                <TerminalIcon className="h-12 w-12 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest opacity-40">Select a host to begin session</p>
                <Button 
                  size="sm" 
                  onClick={() => connectTerminal(selectedHostId)}
                  disabled={!selectedHostId}
                >
                  Connect Now
                </Button>
              </div>
            )}

            {status === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 text-rose-500 bg-slate-950/80 z-20">
                <AlertCircle className="h-12 w-12" />
                <div className="text-center">
                  <p className="text-sm font-bold uppercase tracking-widest">Connection Failed</p>
                  <p className="text-xs text-rose-400/70 mt-1 font-mono">{error}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-rose-500/50 text-rose-500 hover:bg-rose-500/10"
                  onClick={() => connectTerminal(selectedHostId)}
                >
                  Retry Connection
                </Button>
              </div>
            )}

            <div 
              ref={terminalRef} 
              className="absolute inset-0 p-2"
            />
          </div>
          
          {/* Footer Info */}
          <div className="h-6 bg-slate-900 border-t border-slate-800 px-3 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="font-bold uppercase tracking-tighter">Session:</span>
                <span className="text-slate-400 font-mono">{selectedHost?.name || 'None'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold uppercase tracking-tighter">Status:</span>
                <span className={cn(
                  "font-mono capitalize",
                  status === "connected" ? "text-emerald-500" : "text-slate-400"
                )}>{status}</span>
              </div>
            </div>
            <div className="font-mono">
              ALT + ENTER to Toggle Maximize
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idle: "bg-slate-500",
    connecting: "bg-amber-500 animate-pulse",
    connected: "bg-emerald-500",
    error: "bg-rose-500",
    closed: "bg-slate-500",
  };

  return (
    <div className="flex items-center gap-1.5 ml-1">
      <div className={cn("h-1.5 w-1.5 rounded-full", colors[status] || "bg-slate-500")} />
      <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500 leading-none">
        {status}
      </span>
    </div>
  );
}
