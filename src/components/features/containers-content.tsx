"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Server,
  Boxes,
  FolderOpen,
  RefreshCw,
  Square,
  RotateCw,
  Trash2,
  MoreVertical,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  Container,
  HardDrive,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Host {
  id: string;
  name: string;
  host: string;
  connectionType: string;
  isActive: boolean;
}

interface DockerContainerItem {
  id: string;
  name: string;
  status: string;
  image: string;
  ports: number[];
  project?: string;
}

interface HomeProject {
  name: string;
  path: string;
}

export function ContainersContent() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedHostId, setExpandedHostId] = useState<string | null>(null);
  const [containersByHost, setContainersByHost] = useState<Record<string, DockerContainerItem[]>>({});
  const [projectsByHost, setProjectsByHost] = useState<Record<string, HomeProject[]>>({});
  const [loadingHostId, setLoadingHostId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "container-kill" | "container-remove" | "container-remove-volumes" | "project-remove";
    hostId: string;
    containerId?: string;
    projectName?: string;
    removeVolumes?: boolean;
  } | null>(null);

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
      toast.error("Failed to load hosts");
    } finally {
      setLoading(false);
    }
  };

  const loadHostData = async (hostId: string) => {
    setLoadingHostId(hostId);
    try {
      const [containersRes, projectsRes] = await Promise.all([
        fetch(`/api/hosts/${hostId}/containers`),
        fetch(`/api/hosts/${hostId}/projects`),
      ]);

      let containers: DockerContainerItem[] = [];
      let projects: HomeProject[] = [];

      if (containersRes.ok) {
        const data = await containersRes.json();
        containers = Array.isArray(data) ? data : [];
      } else {
        const err = await containersRes.json().catch(() => ({}));
        toast.error(err?.error ?? "Failed to load containers");
      }

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        projects = Array.isArray(data) ? data : [];
      } else {
        const err = await projectsRes.json().catch(() => ({}));
        toast.error(err?.error ?? "Failed to load projects");
      }

      setContainersByHost((prev) => ({ ...prev, [hostId]: containers }));
      setProjectsByHost((prev) => ({ ...prev, [hostId]: projects }));
    } catch (error) {
      console.error("Failed to load host data:", error);
      toast.error("Failed to load containers and projects");
      setContainersByHost((prev) => ({ ...prev, [hostId]: [] }));
      setProjectsByHost((prev) => ({ ...prev, [hostId]: [] }));
    } finally {
      setLoadingHostId(null);
    }
  };

  const toggleHost = (hostId: string) => {
    if (expandedHostId === hostId) {
      setExpandedHostId(null);
      return;
    }
    setExpandedHostId(hostId);
    if (!containersByHost[hostId] && !projectsByHost[hostId]) {
      loadHostData(hostId);
    }
  };

  const refreshHostData = (hostId: string) => {
    loadHostData(hostId);
  };

  const runContainerAction = async (
    hostId: string,
    containerId: string,
    action: "restart" | "stop" | "kill",
    method: "POST" = "POST",
    pathSuffix: string = action
  ) => {
    const key = `${hostId}-${containerId}-${action}`;
    setActionLoading(key);
    try {
      const res = await fetch(`/api/hosts/${hostId}/containers/${containerId}/${pathSuffix}`, {
        method,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message ?? "Done");
        refreshHostData(hostId);
      } else {
        toast.error(data.error ?? "Action failed");
      }
    } catch (error) {
      toast.error("Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const removeContainer = async (hostId: string, containerId: string, removeVolumes: boolean) => {
    const key = `${hostId}-${containerId}-remove`;
    setActionLoading(key);
    try {
      const url = `/api/hosts/${hostId}/containers/${containerId}?removeVolumes=${removeVolumes}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message ?? "Container removed");
        refreshHostData(hostId);
      } else {
        toast.error(data.error ?? "Remove failed");
      }
    } catch (error) {
      toast.error("Network error");
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const runProjectAction = async (
    hostId: string,
    projectName: string,
    action: "restart" | "stop",
    method: "POST" = "POST"
  ) => {
    const key = `${hostId}-${projectName}-${action}`;
    setActionLoading(key);
    try {
      const res = await fetch(`/api/hosts/${hostId}/projects/${encodeURIComponent(projectName)}/${action}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message ?? "Done");
        refreshHostData(hostId);
      } else {
        toast.error(data.error ?? "Action failed");
      }
    } catch (error) {
      toast.error("Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const removeProject = async (hostId: string, projectName: string) => {
    const key = `${hostId}-${projectName}-remove`;
    setActionLoading(key);
    try {
      const res = await fetch(`/api/hosts/${hostId}/projects/${encodeURIComponent(projectName)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message ?? "Project removed");
        refreshHostData(hostId);
      } else {
        toast.error(data.error ?? "Remove failed");
      }
    } catch (error) {
      toast.error("Network error");
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const handleConfirmAction = () => {
    if (!confirmDialog) return;
    if (confirmDialog.type === "container-remove" && confirmDialog.containerId) {
      removeContainer(confirmDialog.hostId, confirmDialog.containerId, false);
    } else if (confirmDialog.type === "container-remove-volumes" && confirmDialog.containerId) {
      removeContainer(confirmDialog.hostId, confirmDialog.containerId, true);
    } else if (confirmDialog.type === "container-kill" && confirmDialog.containerId) {
      runContainerAction(confirmDialog.hostId, confirmDialog.containerId, "kill");
      setConfirmDialog(null);
    } else if (confirmDialog.type === "project-remove" && confirmDialog.projectName) {
      removeProject(confirmDialog.hostId, confirmDialog.projectName);
    }
  };

  const filteredHosts = hosts.filter(
    (h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.host.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isRunning = (status: string) =>
    (status || "").toLowerCase().startsWith("running");

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50/50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50/50 pb-20">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
            Host Containers & Projects
          </h1>
          <p className="text-slate-500 max-w-2xl font-medium mt-1">
            Manage running containers and home-folder projects on each host. Restart, stop, kill, or remove containers and projects.
          </p>
        </div>

        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search hosts by name or address..."
            className="h-full pl-11 bg-white border-none shadow-sm rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {filteredHosts.map((host) => {
              const expanded = expandedHostId === host.id;
              const containers = containersByHost[host.id] ?? [];
              const projects = projectsByHost[host.id] ?? [];
              const loadingHost = loadingHostId === host.id;

              return (
                <motion.div
                  key={host.id}
                  layout
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleHost(host.id)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "p-2.5 rounded-xl",
                          host.isActive ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
                        )}
                      >
                        <Server className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">{host.name}</h2>
                        <p className="text-sm text-slate-500 font-mono">{host.host}</p>
                      </div>
                      <Badge
                        variant={host.isActive ? "success" : "secondary"}
                        className="text-[10px] font-bold uppercase"
                      >
                        {host.isActive ? "Online" : "Offline"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {loadingHost && (
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                      )}
                      {expanded ? (
                        <ChevronDown className="h-5 w-5 text-slate-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-slate-500" />
                      )}
                    </div>
                  </button>

                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-slate-100"
                      >
                        <div className="p-5 space-y-6 bg-slate-50/30">
                          {/* Containers */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                                <Container className="h-4 w-4" />
                                Containers ({containers.length})
                              </h3>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  refreshHostData(host.id);
                                }}
                                disabled={loadingHost}
                              >
                                <RefreshCw className={cn("h-4 w-4", loadingHost && "animate-spin")} />
                              </Button>
                            </div>
                            {containers.length === 0 ? (
                              <div className="text-center py-8 rounded-xl bg-white border border-dashed border-slate-200 text-slate-500 text-sm">
                                No containers
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {containers.map((c) => (
                                  <Card
                                    key={c.id}
                                    className="border-slate-100 shadow-none bg-white"
                                  >
                                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div
                                          className={cn(
                                            "p-1.5 rounded-lg",
                                            isRunning(c.status)
                                              ? "bg-emerald-50 text-emerald-600"
                                              : "bg-slate-100 text-slate-500"
                                          )}
                                        >
                                          <Boxes className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-semibold text-slate-900 truncate">
                                            {c.name}
                                          </p>
                                          <p className="text-xs text-slate-500 truncate">
                                            {c.image}
                                            {c.project && (
                                              <span className="ml-2 text-primary font-medium">
                                                · {c.project}
                                              </span>
                                            )}
                                          </p>
                                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <Badge
                                              variant={isRunning(c.status) ? "success" : "secondary"}
                                              className="text-[10px]"
                                            >
                                              {c.status}
                                            </Badge>
                                            {c.ports.length > 0 && (
                                              <span className="text-[10px] font-mono text-slate-500">
                                                {c.ports.slice(0, 5).join(", ")}
                                                {c.ports.length > 5 && "…"}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 rounded-lg"
                                            disabled={!!actionLoading}
                                          >
                                            {actionLoading?.startsWith(`${host.id}-${c.id}`) ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <MoreVertical className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-52">
                                          <DropdownMenuItem
                                            onClick={() =>
                                              runContainerAction(host.id, c.id, "restart")
                                            }
                                          >
                                            <RotateCw className="h-4 w-4 mr-2" />
                                            Restart
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              runContainerAction(host.id, c.id, "stop")
                                            }
                                          >
                                            <Square className="h-4 w-4 mr-2" />
                                            Stop
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              setConfirmDialog({
                                                type: "container-kill",
                                                hostId: host.id,
                                                containerId: c.id,
                                              })
                                            }
                                            className="text-amber-600"
                                          >
                                            <AlertTriangle className="h-4 w-4 mr-2" />
                                            Kill
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() =>
                                              setConfirmDialog({
                                                type: "container-remove",
                                                hostId: host.id,
                                                containerId: c.id,
                                              })
                                            }
                                            className="text-destructive"
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Remove
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              setConfirmDialog({
                                                type: "container-remove-volumes",
                                                hostId: host.id,
                                                containerId: c.id,
                                                removeVolumes: true,
                                              })
                                            }
                                            className="text-destructive"
                                          >
                                            <HardDrive className="h-4 w-4 mr-2" />
                                            Remove + Volumes
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Projects (home folder) */}
                          <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2 mb-3">
                              <FolderOpen className="h-4 w-4" />
                              Projects in home ({projects.length})
                            </h3>
                            {projects.length === 0 ? (
                              <div className="text-center py-6 rounded-xl bg-white border border-dashed border-slate-200 text-slate-500 text-sm">
                                No projects with docker-compose.yml in home folder
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {projects.map((p) => (
                                  <Card
                                    key={p.name}
                                    className="border-slate-100 shadow-none bg-white"
                                  >
                                    <CardContent className="p-4 flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-3">
                                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                          <FolderOpen className="h-4 w-4" />
                                        </div>
                                        <div>
                                          <p className="font-semibold text-slate-900">{p.name}</p>
                                          <p className="text-xs text-slate-500 font-mono truncate max-w-xs">
                                            {p.path}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-9 rounded-lg"
                                          onClick={() => runProjectAction(host.id, p.name, "restart")}
                                          disabled={!!actionLoading}
                                        >
                                          {actionLoading === `${host.id}-${p.name}-restart` ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <>
                                              <RotateCw className="h-4 w-4 mr-1" />
                                              Restart
                                            </>
                                          )}
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-9 rounded-lg"
                                          onClick={() => runProjectAction(host.id, p.name, "stop")}
                                          disabled={!!actionLoading}
                                        >
                                          {actionLoading === `${host.id}-${p.name}-stop` ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <>
                                              <Square className="h-4 w-4 mr-1" />
                                              Stop
                                            </>
                                          )}
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-9 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                                          onClick={() =>
                                            setConfirmDialog({
                                              type: "project-remove",
                                              hostId: host.id,
                                              projectName: p.name,
                                            })
                                          }
                                          disabled={!!actionLoading}
                                        >
                                          {actionLoading === `${host.id}-${p.name}-remove` ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <>
                                              <Trash2 className="h-4 w-4 mr-1" />
                                              Remove
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Confirm dialogs */}
      <AlertDialog
        open={!!confirmDialog}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.type === "container-kill" && "Kill container?"}
              {confirmDialog?.type === "container-remove" && "Remove container?"}
              {confirmDialog?.type === "container-remove-volumes" &&
                "Remove container and its volumes?"}
              {confirmDialog?.type === "project-remove" && "Remove project?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.type === "container-kill" &&
                "The container will be force-killed (SIGKILL)."}
              {confirmDialog?.type === "container-remove" &&
                "The container will be removed. Anonymous volumes linked to it may remain."}
              {confirmDialog?.type === "container-remove-volumes" &&
                "The container and its anonymous volumes will be removed. This cannot be undone."}
              {confirmDialog?.type === "project-remove" &&
                "Containers will be stopped and removed, volumes removed, and the project folder deleted from the host."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                "rounded-xl font-bold",
                (confirmDialog?.type === "container-kill" ||
                  confirmDialog?.type === "project-remove" ||
                  confirmDialog?.type?.startsWith("container-")) &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmAction();
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
