"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deploymentTemplates,
  templateCategories,
  type DeploymentTemplate,
} from "@/data/templates";
import {
  Rocket,
  Database,
  Cpu,
  Layers,
  Server,
  Loader2,
  Sparkles,
  FileCode,
  Search,
  Check,
  AlertCircle,
  Info,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const categoryIcons: Record<DeploymentTemplate["category"], React.ElementType> = {
  ai: Sparkles,
  database: Database,
  runtime: Cpu,
  app: Layers,
};

interface Host {
  id: string;
  name: string;
}

interface PlacementRecommendation {
  recommendedHost: {
    hostId: string;
    hostName: string;
    score: number;
    reasons: string[];
  };
  alternativeHosts: Array<{
    hostId: string;
    hostName: string;
    score: number;
    reasons: string[];
  }>;
}

interface HostValidationResult {
  valid: boolean;
  message: string;
  portChanges: Array<{ from: number; to: number; serviceName: string }>;
  errors: string[];
  modifiedComposeContent?: string;
}

export function TemplatesContent() {
  const router = useRouter();
  const [hosts, setHosts] = useState<Host[]>([]);
  const [deployTemplate, setDeployTemplate] = useState<DeploymentTemplate | null>(null);
  const [projectName, setProjectName] = useState("");
  const [selectedHostId, setSelectedHostId] = useState("");
  const [envContent, setEnvContent] = useState("");
  const [envLoading, setEnvLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<PlacementRecommendation | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [validationResult, setValidationResult] = useState<HostValidationResult | null>(null);
  const [validatingHost, setValidatingHost] = useState(false);

  useEffect(() => {
    fetch("/api/hosts")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setHosts(data) : setHosts([])))
      .catch(() => setHosts([]));
  }, []);

  useEffect(() => {
    if (selectedHostId && deployTemplate) {
      handleValidateHost(selectedHostId, deployTemplate.composeContent);
    }
  }, [selectedHostId, deployTemplate]);

  const handleValidateHost = async (hostId: string, composeContent: string) => {
    if (!hostId || !composeContent) return;
    setValidatingHost(true);
    try {
      const res = await fetch("/api/deployments/validate-host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId, composeContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setValidationResult(data);
        if (data.portChanges.length > 0) {
          toast.info("Port conflicts detected and resolved with free ports.");
        }
      }
    } catch (e) {
      console.error("Validation failed:", e);
    } finally {
      setValidatingHost(false);
    }
  };

  const handleSuggestHost = async (template: DeploymentTemplate) => {
    if (!template.composeContent) return;

    setLoadingRecommendation(true);
    try {
      const response = await fetch("/api/deployments/suggest-host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ composeContent: template.composeContent }),
      });

      const data = await response.json();

      if (response.ok) {
        setRecommendation(data);
        const hostId = data.recommendedHost.hostId;
        setSelectedHostId(hostId);
        toast.success(`Recommended host: ${data.recommendedHost.hostName}`);
        
        // Validate the recommended host immediately
        handleValidateHost(hostId, template.composeContent);
      }
    } catch (error) {
      console.error("Failed to get recommendation:", error);
    } finally {
      setLoadingRecommendation(false);
    }
  };

  const openDeployDialog = (template: DeploymentTemplate) => {
    setDeployTemplate(template);
    setProjectName(template.id.replace(/-/g, "_"));
    setSelectedHostId("");
    setRecommendation(null);
    setValidationResult(null);
    const defaultEnv = template.defaultEnv ? `${template.defaultEnv}\n` : "";
    setEnvContent(defaultEnv);
    setEnvLoading(true);
    
    // Auto-suggest host
    handleSuggestHost(template);

    fetch("/api/deployments/suggest-env", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ composeContent: template.composeContent }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.envContent?.trim()) {
          setEnvContent((prev) => (prev.trim() ? `${prev.trim()}\n${data.envContent}` : data.envContent));
        }
      })
      .catch(() => {})
      .finally(() => setEnvLoading(false));
  };

  const closeDeployDialog = () => {
    if (deploying) return;
    setDeployTemplate(null);
    setDeployProgress(null);
    setRecommendation(null);
    setValidationResult(null);
  };

  const handleDeploy = async () => {
    if (!deployTemplate || !projectName.trim() || !selectedHostId) {
      toast.error("Please set project name and select a host");
      return;
    }

    // Use modified compose if validation fixed ports
    const finalComposeContent = validationResult?.modifiedComposeContent || deployTemplate.composeContent;

    setDeploying(true);
    setDeployProgress("Creating compose file…");
    try {
      const fileRes = await fetch("/api/compose-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${deployTemplate.name} (${projectName})`,
          content: finalComposeContent,
          generatedBy: "Template",
        }),
      });
      if (!fileRes.ok) {
        const err = await fileRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create compose file");
      }
      const fileData = await fileRes.json();

      setDeployProgress("Deploying to host…");
      const deployRes = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          composeFileId: fileData.id,
          hostId: selectedHostId,
          composeContent: finalComposeContent,
          projectName: projectName.trim(),
          envContent: envContent.trim() || undefined,
        }),
      });

      if (!deployRes.ok) {
        const err = await deployRes.json().catch(() => ({}));
        throw new Error(err.error || "Deployment failed");
      }
      
      const deployData = await deployRes.json();
      setDeployProgress("Done.");
      
      if (deployData.autoPortFixes?.length > 0) {
        toast.success(`${deployTemplate.name} deployed with automatic port remapping to avoid conflicts.`);
      } else {
        toast.success(`${deployTemplate.name} deployed successfully`);
      }
      
      closeDeployDialog();
      router.push("/deployments");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deployment failed");
      setDeployProgress(null);
    } finally {
      setDeploying(false);
    }
  };

  const filteredTemplates = deploymentTemplates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-full bg-slate-50/50 pb-20">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
              Templates
            </h1>
            <p className="text-slate-500 max-w-2xl">
              Deploy preconfigured stacks in one click. Choose a template, pick a host and project name, then deploy.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-all h-10"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="rounded-full px-4"
            >
              All
            </Button>
            {Object.entries(templateCategories).map(([id, label]) => (
              <Button
                key={id}
                variant={selectedCategory === id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(id)}
                className="rounded-full px-4 whitespace-nowrap"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredTemplates.map((template) => {
              const Icon = categoryIcons[template.category];
              const categoryLabel = templateCategories[template.category];
              return (
                <motion.div
                  key={template.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className="group border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full bg-white"
                  >
                    <div className="h-1.5 bg-primary/80 w-full transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-bold text-slate-900">{template.name}</CardTitle>
                            <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider mt-1 bg-slate-100 text-slate-500 border-none">
                              {categoryLabel}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <CardDescription className="text-sm text-slate-500 leading-relaxed mt-2 line-clamp-3">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 mt-auto pb-6">
                      <Button
                        onClick={() => openDeployDialog(template)}
                        className="w-full bg-slate-900 hover:bg-primary text-white shadow-lg shadow-slate-200 group-hover:shadow-primary/20 transition-all duration-300 h-11 rounded-xl font-bold"
                      >
                        <Rocket className="h-4 w-4 mr-2" />
                        Deploy Template
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <Dialog open={!!deployTemplate} onOpenChange={(open) => !open && closeDeployDialog()}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-lg p-0 overflow-hidden">
          <div className="h-2 bg-primary w-full" />
          <div className="p-8 space-y-6">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <FileCode className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-slate-900">
                    Deploy {deployTemplate?.name}
                  </DialogTitle>
                  <DialogDescription className="text-slate-500">
                    Configure your deployment settings below
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {deployTemplate && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="template-project-name" className="text-xs font-bold uppercase tracking-wider text-slate-500">Project Name</Label>
                  <Input
                    id="template-project-name"
                    placeholder="e.g. my-langflow"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    disabled={deploying}
                    className="bg-slate-50 border-slate-200 focus:bg-white transition-all h-12 text-base font-medium rounded-xl"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="template-host" className="text-xs font-bold uppercase tracking-wider text-slate-500">Target Host</Label>
                    {loadingRecommendation && (
                      <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Analyzing Hosts...
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="relative">
                      <select
                        id="template-host"
                        value={selectedHostId}
                        onChange={(e) => {
                          const newHostId = e.target.value;
                          setSelectedHostId(newHostId);
                        }}
                        disabled={deploying}
                        className={cn(
                          "flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-base font-medium transition-all appearance-none",
                          "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white"
                        )}
                      >
                        <option value="">Select a host</option>
                        {hosts.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} {recommendation?.recommendedHost.hostId === h.id ? "⭐ (Recommended)" : ""}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        {validatingHost ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4 rotate-90" />}
                      </div>
                    </div>

                    <AnimatePresence>
                      {validationResult && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className={cn(
                            "rounded-xl border p-3 space-y-2",
                            validationResult.valid ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50/50 border-rose-100"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {validationResult.valid ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-rose-600" />
                            )}
                            <span className={cn(
                              "text-xs font-bold uppercase tracking-wider",
                              validationResult.valid ? "text-emerald-700" : "text-rose-700"
                            )}>
                              {validationResult.valid ? "Host Validated" : "Validation Issues"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {validationResult.message}
                          </p>
                          {validationResult.portChanges.length > 0 && (
                            <div className="bg-white/50 rounded-lg p-2 space-y-1 border border-emerald-100">
                              <span className="text-[10px] font-bold text-emerald-700 uppercase">Automatic Port Fixes:</span>
                              {validationResult.portChanges.map((change, i) => (
                                <div key={i} className="text-[10px] font-mono text-slate-500">
                                  {change.serviceName}: {change.from} → <span className="text-emerald-600 font-bold">{change.to}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {recommendation && !validationResult && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-2"
                        >
                          <div className="flex items-center gap-2 text-primary">
                            <Sparkles className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">AI Placement Recommendation</span>
                          </div>
                          <p className="text-sm text-slate-600 font-medium">
                            We recommend <span className="text-primary font-bold">{recommendation.recommendedHost.hostName}</span> because:
                          </p>
                          <ul className="space-y-1">
                            {recommendation.recommendedHost.reasons.map((reason, i) => (
                              <li key={i} className="flex items-center gap-2 text-xs text-slate-500">
                                <div className="h-1 w-1 rounded-full bg-primary" />
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {hosts.length === 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-xs font-medium">
                      <AlertCircle className="h-4 w-4" />
                      No hosts configured. Add one in Settings first.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Environment Variables</Label>
                    {envLoading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                  </div>
                  <div className="relative group">
                    <Textarea
                      placeholder="KEY=value"
                      value={envContent}
                      onChange={(e) => setEnvContent(e.target.value)}
                      disabled={deploying}
                      className="font-mono text-sm min-h-[120px] bg-slate-900 text-slate-100 border-none rounded-2xl p-4 focus-visible:ring-2 focus-visible:ring-primary/50"
                    />
                    <div className="absolute top-3 right-3">
                      <Badge variant="outline" className="bg-slate-800/50 text-slate-400 border-slate-700 backdrop-blur-sm text-[10px]">.ENV</Badge>
                    </div>
                  </div>
                </div>

                {deployProgress && (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-medium text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    {deployProgress}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-4 gap-3">
              <Button 
                variant="ghost" 
                onClick={closeDeployDialog} 
                disabled={deploying}
                className="rounded-xl font-bold text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeploy}
                disabled={
                  deploying ||
                  !projectName.trim() ||
                  !selectedHostId ||
                  !deployTemplate
                }
                className="rounded-xl font-bold px-8 bg-primary text-white shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all h-12"
              >
                {deploying ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Rocket className="h-4 w-4 mr-2" />
                )}
                Launch Stack
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
