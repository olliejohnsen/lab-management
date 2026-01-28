"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DockerMetrics } from "@/types/docker";
import { Server, Cpu, HardDrive, Network, Activity, Circle, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface HostCardProps {
  host: {
    id: string;
    name: string;
    host: string;
    connectionType: string;
    isActive: boolean;
  };
  metrics?: DockerMetrics;
}

export function HostCard({ host, metrics }: HostCardProps) {
  const getStatusColor = (usage: number) => {
    if (usage < 50) return "bg-emerald-500";
    if (usage < 80) return "bg-amber-500";
    return "bg-rose-500";
  };

  const getStatusText = (usage: number) => {
    if (usage < 50) return "Optimal";
    if (usage < 80) return "Moderate";
    return "High Load";
  };

  const MetricRow = ({ 
    icon: Icon, 
    label, 
    value, 
    colorClass 
  }: { 
    icon: any, 
    label: string, 
    value: number, 
    colorClass: string 
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5" />
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium lowercase">{getStatusText(value)}</span>
          <span className="text-slate-900">{value.toFixed(1)}%</span>
        </div>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn("h-full rounded-full", colorClass)}
        />
      </div>
    </div>
  );

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={cn(
        "border-none shadow-xl shadow-slate-200/50 overflow-hidden group",
        !host.isActive && "opacity-60 grayscale"
      )}>
        <div className={cn(
          "h-1.5 w-full",
          host.isActive ? "bg-primary" : "bg-slate-300"
        )} />
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-xl transition-colors",
                host.isActive ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
              )}>
                <Server className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors">
                  {host.name}
                </CardTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <Globe className="h-3 w-3 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">{host.host}</span>
                  <div className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="text-[10px] font-bold uppercase tracking-tight text-slate-400">{host.connectionType}</span>
                </div>
              </div>
            </div>
            <Badge 
              variant={host.isActive ? "success" : "secondary"}
              className={cn(
                "rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                host.isActive ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
              )}
            >
              <Circle className={cn("h-2 w-2 mr-1 fill-current", host.isActive && "animate-pulse")} />
              {host.isActive ? "Online" : "Offline"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {metrics ? (
            <>
              <MetricRow 
                icon={Cpu} 
                label="Processor" 
                value={metrics.cpuUsage} 
                colorClass={getStatusColor(metrics.cpuUsage)} 
              />
              <MetricRow 
                icon={Activity} 
                label="Memory" 
                value={metrics.ramUsage} 
                colorClass={getStatusColor(metrics.ramUsage)} 
              />
              <MetricRow 
                icon={HardDrive} 
                label="Storage" 
                value={metrics.diskUsage} 
                colorClass={getStatusColor(metrics.diskUsage)} 
              />

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Ports</span>
                </div>
                <Badge variant="outline" className="rounded-md font-mono font-bold bg-slate-50 text-slate-700 border-slate-200">
                  {metrics.usedPorts.length}
                </Badge>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 space-y-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Activity className="h-8 w-8 text-slate-300" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Awaiting Metrics
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
