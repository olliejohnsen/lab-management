"use client";

import { useEffect, useState } from "react";
import { HostCard } from "./host-card";
import { useMetricsStream } from "@/hooks/use-metrics-stream";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  Activity, 
  Server, 
  ShieldCheck, 
  Zap, 
  ArrowUpRight, 
  Plus,
  LayoutGrid,
  List,
  Search,
  Circle,
  Clock,
  Cpu,
  HardDrive
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface Host {
  id: string;
  name: string;
  host: string;
  connectionType: string;
  isActive: boolean;
}

export function DashboardContent() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const { metrics, connected } = useMetricsStream();

  useEffect(() => {
    fetchHosts();
  }, []);

  const fetchHosts = async () => {
    try {
      const response = await fetch("/api/hosts");
      if (response.ok) {
        const data = await response.json();
        setHosts(data);
      }
    } catch (error) {
      console.error("Failed to fetch hosts:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredHosts = hosts.filter(h => 
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.host.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCpu = Object.values(metrics).reduce((acc, m) => acc + m.cpuUsage, 0) / (Object.keys(metrics).length || 1);
  const totalRam = Object.values(metrics).reduce((acc, m) => acc + m.ramUsage, 0) / (Object.keys(metrics).length || 1);

  return (
    <div className="min-h-full bg-slate-50/50 pb-20">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">DEV Overview</h1>
            <p className="text-slate-500 max-w-2xl font-medium">
              Real-time monitoring and management of your distributed Docker infrastructure.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all",
              connected 
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" 
                : "bg-rose-500/10 text-rose-600 border-rose-200"
            )}>
              <Circle className={cn("h-2 w-2 fill-current", connected && "animate-pulse")} />
              {connected ? "Live Metrics" : "Stream Offline"}
            </div>
            <Button variant="outline" size="sm" className="rounded-xl bg-white shadow-sm h-9 font-bold" onClick={fetchHosts}>
              <RefreshCw className={cn("h-3.5 w-3.5 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Active Nodes" 
            value={hosts.filter(h => h.isActive).length.toString().padStart(2, '0')} 
            icon={Server} 
            trend="+0 this week"
            color="primary"
          />
          <StatCard 
            title="Avg CPU Load" 
            value={`${totalCpu.toFixed(0)}%`} 
            icon={Cpu} 
            trend={totalCpu > 50 ? "High usage" : "Normal"}
            color="emerald"
          />
          <StatCard 
            title="Avg RAM Load" 
            value={`${totalRam.toFixed(0)}%`} 
            icon={Activity} 
            trend="Stable"
            color="blue"
          />
          <StatCard 
            title="Storage Status" 
            value="Healthy" 
            icon={HardDrive} 
            trend="All nodes online"
            color="amber"
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search nodes by name or IP..." 
              className="pl-11 bg-slate-50 border-none rounded-xl h-11 focus-visible:ring-2 focus-visible:ring-primary/20 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <Button 
                variant={viewMode === 'grid' ? 'white' : 'ghost'} 
                size="sm" 
                className={cn("h-9 rounded-lg px-3 font-bold", viewMode === 'grid' && "shadow-sm")}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewMode === 'list' ? 'white' : 'ghost'} 
                size="sm" 
                className={cn("h-9 rounded-lg px-3 font-bold", viewMode === 'list' && "shadow-sm")}
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block" />
            <Link href="/settings" className="flex-1 sm:flex-none">
              <Button className="w-full h-11 rounded-xl font-bold shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4 mr-2" />
                Add Host
              </Button>
            </Link>
          </div>
        </div>

        {/* Hosts Grid */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-32 space-y-4"
            >
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary/20" />
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Synchronizing Nodes...</p>
            </motion.div>
          ) : filteredHosts.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-32 bg-white rounded-3xl border-2 border-dashed border-slate-200 space-y-6"
            >
              <div className="h-24 w-24 rounded-full bg-slate-50 flex items-center justify-center mx-auto">
                <Server className="h-10 w-10 text-slate-200" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">No nodes found</h3>
                <p className="text-slate-500 max-w-xs mx-auto font-medium">
                  {searchQuery ? `No results for "${searchQuery}".` : "You haven't added any Docker hosts to your DEV environment yet."}
                </p>
              </div>
              {!searchQuery && (
                <Link href="/settings">
                  <Button variant="outline" className="rounded-xl px-8 h-12 font-bold">
                    Add your first host
                  </Button>
                </Link>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "grid gap-6",
                viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
              )}
            >
              {filteredHosts.map((host, index) => (
                <motion.div
                  key={host.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <HostCard
                    host={host}
                    metrics={metrics[host.id]}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, color }: { title: string, value: string, icon: any, trend: string, color: string }) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary text-primary-foreground",
    emerald: "bg-emerald-500 text-white",
    blue: "bg-blue-500 text-white",
    amber: "bg-amber-500 text-white",
  };

  return (
    <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-2.5 rounded-xl transition-transform group-hover:scale-110 duration-300", colorMap[color])}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{trend}</div>
        </div>
        <div className="space-y-1">
          <div className="text-3xl font-black text-slate-900 tracking-tight">{value}</div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={cn("animate-spin", className)}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}
