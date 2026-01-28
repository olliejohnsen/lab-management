"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Trash2, 
  Server, 
  Calendar, 
  Activity, 
  ExternalLink, 
  MoreVertical,
  Search,
  Filter,
  Package,
  Sparkles,
  Github,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Loader2,
  Download
} from "lucide-react";
import Link from "next/link";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Deployment {
  id: string;
  status: string;
  deployedAt: string;
  metadata?: string | null;
  host: {
    id: string;
    name: string;
    host?: string;
  };
  composeFile: {
    id: string;
    name: string;
    generatedBy: string;
  };
}

export function DeploymentsContent() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openingAppId, setOpeningAppId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<Array<{ id: string; name: string; projects: Array<{ name: string }>; error?: string }>>([]);
  const [importPreviewTotalHosts, setImportPreviewTotalHosts] = useState(0);
  const [importPreviewLoading, setImportPreviewLoading] = useState(false);
  const [selectedImportKeys, setSelectedImportKeys] = useState<Set<string>>(new Set());
  const [importSubmitting, setImportSubmitting] = useState(false);

  useEffect(() => {
    fetchDeployments();
  }, []);

  const fetchDeployments = async () => {
    try {
      const response = await fetch("/api/deployments");
      if (response.ok) {
        const data = await response.json();
        setDeployments(data);
      }
    } catch (error) {
      console.error("Failed to fetch deployments:", error);
      toast.error("Failed to load deployments");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenApp = async (deploymentId: string) => {
    setOpeningAppId(deploymentId);
    try {
      const res = await fetch(`/api/deployments/${deploymentId}/app-url`);
      const data = await res.json();
      if (res.ok && data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(data.error ?? "Could not get app URL");
      }
    } catch (error) {
      console.error("Failed to get app URL:", error);
      toast.error("Failed to open app");
    } finally {
      setOpeningAppId(null);
    }
  };

  const openImportDialog = async () => {
    setImportDialogOpen(true);
    setImportPreviewLoading(true);
    setImportPreview([]);
    setSelectedImportKeys(new Set());
    try {
      const res = await fetch("/api/deployments/import/preview");
      const data = await res.json();
      if (res.ok && data.hosts) {
        setImportPreview(data.hosts);
        setImportPreviewTotalHosts(data.totalHosts ?? data.hosts.length);
        const allKeys = new Set<string>();
        data.hosts.forEach(
          (h: { id: string; projects: Array<{ name: string }> }) =>
            h.projects?.forEach((p: { name: string }) => allKeys.add(`${h.id}|${p.name}`))
        );
        setSelectedImportKeys(allKeys);
      } else {
        toast.error(data.error ?? "Failed to load import preview");
      }
    } catch (error) {
      console.error("Failed to load import preview:", error);
      toast.error("Failed to load import preview");
    } finally {
      setImportPreviewLoading(false);
    }
  };

  const toggleImportSelection = (key: string) => {
    setSelectedImportKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllImport = () => {
    const all = new Set<string>();
    importPreview.forEach((h) => h.projects?.forEach((p) => all.add(`${h.id}|${p.name}`)));
    setSelectedImportKeys(all);
  };

  const deselectAllImport = () => setSelectedImportKeys(new Set());

  const handleImportSelected = async () => {
    const selections = Array.from(selectedImportKeys).map((key) => {
      const [hostId, projectName] = key.split("|");
      return { hostId, projectName };
    });
    if (selections.length === 0) {
      toast.error("Select at least one project to import");
      return;
    }
    setImportSubmitting(true);
    try {
      const res = await fetch("/api/deployments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const detail =
          data.hostResults?.length > 0
            ? data.hostResults
                .map(
                  (h: { name: string; count: number; error?: string }) =>
                    h.error ? `${h.name}: failed` : `${h.name}: ${h.count}`
                )
                .join(" · ")
            : null;
        toast.success(detail ? `${data.message ?? "Import complete"} (${detail})` : data.message ?? "Import complete");
        setImportDialogOpen(false);
        fetchDeployments();
      } else {
        toast.error(data.error ?? "Import failed");
      }
    } catch (error) {
      console.error("Failed to import:", error);
      toast.error("Failed to import deployments");
    } finally {
      setImportSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/deployments/${deleteId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Deployment removed successfully");
        fetchDeployments();
      } else {
        const error = await response.json();
        toast.error(`Failed to remove deployment: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to delete deployment:", error);
      toast.error("Network error while removing deployment");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const getStatusVariant = (status: string): "success" | "warning" | "destructive" | "secondary" => {
    switch (status.toLowerCase()) {
      case "running":
        return "success";
      case "pending":
        return "warning";
      case "failed":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "running":
        return <CheckCircle2 className="h-3 w-3 mr-1" />;
      case "pending":
        return <Clock className="h-3 w-3 mr-1 animate-pulse" />;
      case "failed":
        return <AlertCircle className="h-3 w-3 mr-1" />;
      default:
        return <Activity className="h-3 w-3 mr-1" />;
    }
  };

  const filteredDeployments = deployments.filter(d => 
    d.composeFile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.host.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-full bg-slate-50/50 pb-20">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Deployments</h1>
            <p className="text-slate-500 max-w-2xl font-medium">
              Monitor and manage your active application stacks across all hosts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-12 px-6 rounded-xl font-bold border-slate-200"
              onClick={openImportDialog}
            >
              <Download className="h-5 w-5 mr-2" />
              Import deployment
            </Button>
            <Link href="/deployments/new">
              <Button className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20 font-bold">
                <Plus className="h-5 w-5 mr-2" />
                New Deployment
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm bg-white p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{deployments.length}</div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Stacks</div>
            </div>
          </Card>
          <Card className="border-none shadow-sm bg-white p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {deployments.filter(d => d.status.toLowerCase() === 'running').length}
              </div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Running</div>
            </div>
          </Card>
          <div className="md:col-span-2 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search deployments by name or host..." 
              className="h-full pl-11 bg-white border-none shadow-sm rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Deployments List */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {loading ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 space-y-4"
              >
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary/20" />
                <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Syncing Infrastructure...</p>
              </motion.div>
            ) : filteredDeployments.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-dashed border-2 bg-transparent">
                  <CardContent className="flex flex-col items-center justify-center py-20 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center">
                      <Package className="h-10 w-10 text-slate-300" />
                    </div>
                    <div className="text-center space-y-1">
                      <h3 className="text-xl font-bold text-slate-900">No deployments found</h3>
                      <p className="text-slate-500 max-w-xs mx-auto">
                        {searchQuery ? `No results for "${searchQuery}". Try a different search.` : "You haven't deployed any stacks yet. Let's get started!"}
                      </p>
                    </div>
                    {!searchQuery && (
                      <Link href="/deployments/new">
                        <Button variant="outline" className="rounded-xl px-8 h-11 font-bold">
                          Create your first deployment
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              filteredDeployments.map((deployment, index) => {
                const deploymentMeta = (() => {
                  try {
                    return deployment.metadata ? JSON.parse(deployment.metadata) : {};
                  } catch {
                    return {};
                  }
                })();
                const isImported = !!deploymentMeta.imported;
                const displayName = isImported
                  ? (deploymentMeta.projectName || deployment.composeFile.name)
                  : deployment.composeFile.name;

                return (
                <motion.div
                  key={deployment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="border-none shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group overflow-hidden">
                    <div className={cn(
                      "absolute left-0 top-0 bottom-0 w-1.5 transition-all group-hover:w-2",
                      deployment.status.toLowerCase() === 'running' ? "bg-emerald-500" : 
                      deployment.status.toLowerCase() === 'failed' ? "bg-rose-500" : "bg-amber-500"
                    )} />
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row md:items-center p-6 gap-6">
                        {/* Name & Host */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-xl font-bold text-slate-900 group-hover:text-primary transition-colors">
                              {displayName}
                            </h3>
                            <div className="flex items-center gap-1.5">
                              {isImported && (
                                <Badge variant="secondary" className="rounded-md text-[10px] font-bold uppercase tracking-tight bg-slate-100 text-slate-600 border-slate-200">
                                  <Download className="h-2.5 w-2.5 mr-1" />
                                  Imported
                                </Badge>
                              )}
                              {deployment.composeFile.generatedBy === "AI" && (
                                <Badge className="bg-primary/10 text-primary border-primary/20 rounded-md text-[10px] font-bold uppercase tracking-tight">
                                  <Sparkles className="h-2.5 w-2.5 mr-1" />
                                  AI
                                </Badge>
                              )}
                              {deployment.composeFile.generatedBy === "GitHub" && (
                                <Badge className="bg-slate-900 text-white border-none rounded-md text-[10px] font-bold uppercase tracking-tight">
                                  <Github className="h-2.5 w-2.5 mr-1" />
                                  GitHub
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-y-2 gap-x-4">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                              <Server className="h-3.5 w-3.5" />
                              {deployment.host.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(deployment.deployedAt).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(deployment.deployedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        {/* Status & Actions */}
                        <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-none pt-4 md:pt-0">
                          <Badge 
                            variant={getStatusVariant(deployment.status)}
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
                              deployment.status.toLowerCase() === 'running' ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" : 
                              deployment.status.toLowerCase() === 'failed' ? "bg-rose-500/10 text-rose-600 border-rose-200" : 
                              "bg-amber-500/10 text-amber-600 border-amber-200"
                            )}
                          >
                            {getStatusIcon(deployment.status)}
                            {deployment.status}
                          </Badge>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-xl hover:bg-primary/5 hover:text-primary"
                              title="Open App"
                              onClick={() => handleOpenApp(deployment.id)}
                              disabled={!!openingAppId}
                            >
                              {openingAppId === deployment.id ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <ArrowUpRight className="h-5 w-5" />
                              )}
                            </Button>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-xl">
                                  <MoreVertical className="h-5 w-5 text-slate-400" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 shadow-xl border-slate-200/60">
                                <DropdownMenuItem className="rounded-lg cursor-pointer" asChild>
                                  <Link href={`/deployments/${deployment.id}`}>
                                    <ArrowUpRight className="mr-2 h-4 w-4 text-slate-500" />
                                    <span>View Details</span>
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="rounded-lg cursor-pointer">
                                  <Activity className="mr-2 h-4 w-4 text-slate-500" />
                                  <span>View Logs</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="rounded-lg cursor-pointer"
                                  onClick={() => handleOpenApp(deployment.id)}
                                  disabled={!!openingAppId}
                                >
                                  {openingAppId === deployment.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 text-slate-500 animate-spin" />
                                  ) : (
                                    <ExternalLink className="mr-2 h-4 w-4 text-slate-500" />
                                  )}
                                  <span>Open App</span>
                                </DropdownMenuItem>
                                {!isImported && (
                                  <DropdownMenuItem 
                                    className="rounded-lg cursor-pointer text-destructive focus:bg-destructive/5 focus:text-destructive"
                                    onClick={() => setDeleteId(deployment.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Remove Stack</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Import deployment dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="rounded-2xl border-none shadow-2xl max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Import running deployments</DialogTitle>
            <DialogDescription className="text-slate-500">
              Select which running projects on your hosts to add to the list. Only projects not already listed are shown.
            </DialogDescription>
          </DialogHeader>
          {importPreviewLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-slate-500">Scanning hosts...</p>
            </div>
          ) : importPreview.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm space-y-1">
              {importPreviewTotalHosts === 0 ? (
                <p>No hosts configured. Add hosts in Settings to import from them.</p>
              ) : (
                <>
                  <p>Checked {importPreviewTotalHosts} host{importPreviewTotalHosts !== 1 ? "s" : ""}.</p>
                  <p>No importable projects found. All running projects may already be listed, or hosts could not be reached.</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                <span>Checked {importPreviewTotalHosts} host{importPreviewTotalHosts !== 1 ? "s" : ""} · {selectedImportKeys.size} selected</span>
                <div className="flex gap-2">
                  <button type="button" onClick={selectAllImport} className="hover:text-primary font-bold">
                    Select all
                  </button>
                  <span className="text-slate-300">|</span>
                  <button type="button" onClick={deselectAllImport} className="hover:text-primary font-bold">
                    Deselect all
                  </button>
                </div>
              </div>
              <div className="w-full max-h-[320px] sm:max-h-[55vh] border rounded-xl border-slate-200 overflow-y-auto overflow-x-hidden overscroll-contain">
                <div className="p-2 space-y-4 pr-2">
                  {importPreview.map((host) => (
                    <div key={host.id} className="space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <Server className="h-4 w-4 text-slate-500" />
                        {host.name}
                        {host.error && (
                          <Badge variant="secondary" className="text-[10px] font-normal text-amber-600 bg-amber-50">
                            Failed
                          </Badge>
                        )}
                      </div>
                      {host.projects.length === 0 ? (
                        <p className="text-xs text-slate-400 pl-6">{host.error ?? "No new projects"}</p>
                      ) : (
                        <div className="pl-6 space-y-1.5">
                          {host.projects.map((project) => {
                            const key = `${host.id}|${project.name}`;
                            const checked = selectedImportKeys.has(key);
                            return (
                              <label
                                key={key}
                                className={cn(
                                  "flex items-center gap-3 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors",
                                  checked && "bg-primary/5"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleImportSelection(key)}
                                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                                />
                                <span className="text-sm font-medium text-slate-800 truncate">{project.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter className="mt-4 gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  className="rounded-xl font-bold"
                  onClick={() => setImportDialogOpen(false)}
                  disabled={importSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  className="rounded-xl font-bold shadow-lg shadow-primary/20"
                  onClick={handleImportSelected}
                  disabled={selectedImportKeys.size === 0 || importSubmitting}
                >
                  {importSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Import {selectedImportKeys.size} selected
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
              <Trash2 className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold text-slate-900">Remove Stack?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-base">
              This will stop all containers and remove the deployment from the host. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl h-12 font-bold" disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="rounded-xl h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold shadow-lg shadow-destructive/20"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Removing...
                </>
              ) : (
                "Yes, Remove Stack"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
