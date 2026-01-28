"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  RefreshCw, 
  Github, 
  Sparkles, 
  Rocket, 
  FileCode, 
  Settings2,
  Info,
  Copy,
  Check,
  ChevronRight,
  Terminal,
  Loader2,
  ExternalLink,
  Server
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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

export function NewDeploymentContent() {
  const router = useRouter();
  const [hosts, setHosts] = useState<Host[]>([]);
  const [projectName, setProjectName] = useState("");
  const [composeContent, setComposeContent] = useState("");
  const [selectedHostId, setSelectedHostId] = useState("");
  const [recommendation, setRecommendation] = useState<PlacementRecommendation | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [hostValidationResult, setHostValidationResult] = useState<{
    message: string;
    portChanges: Array< { serviceName: string; from: number; to: number; containerPort: string } >;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [suggestHostError, setSuggestHostError] = useState<string | null>(null);
  const [envContent, setEnvContent] = useState("");
  const [envLoading, setEnvLoading] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  /** When set, deploy will use git clone on host instead of uploading compose content */
  const [githubDeploy, setGithubDeploy] = useState<{ cloneUrl: string; composePath: string; branch?: string } | null>(null);
  /** AI-generated Dockerfile when repo had no compose/Dockerfile; injected into cloned dir on deploy */
  const [dockerfileContent, setDockerfileContent] = useState("");
  /** Progress messages during GitHub fetch (streaming) */
  const [fetchProgress, setFetchProgress] = useState<string[]>([]);
  /** Progress message during deploy */
  const [deployProgress, setDeployProgress] = useState<string | null>(null);
  /** Error dialog state */
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  /** Copy success state */
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchHosts = useCallback(async () => {
    try {
      const response = await fetch("/api/hosts");
      if (response.ok) {
        const data = await response.json();
        setHosts(data);
      }
    } catch (error) {
      console.error("Failed to fetch hosts:", error);
    }
  }, []);

  useEffect(() => {
    fetchHosts();
  }, [fetchHosts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromAi = sessionStorage.getItem("compose-content");
    if (fromAi) {
      setComposeContent(fromAi);
      sessionStorage.removeItem("compose-content");
      // Suggest .env for compose from AI
      fetch("/api/deployments/suggest-env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ composeContent: fromAi }),
      })
        .then((r) => r.ok && r.json())
        .then((data) => data?.envContent && setEnvContent(data.envContent))
        .catch(() => {});
    }
  }, []);

  const handleValidateHost = useCallback(async () => {
    if (!composeContent || !selectedHostId) return;

    setLoading(true);
    setHostValidationResult(null);
    try {
      const response = await fetch("/api/deployments/validate-host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId: selectedHostId,
          composeContent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setHostValidationResult({
          message: data.error || "Validation failed",
          portChanges: [],
          error: data.error,
        });
        toast.error("Host validation failed");
        return;
      }

      if (data.modifiedComposeContent) {
        setComposeContent(data.modifiedComposeContent);
        toast.info("Compose file updated with free ports");
      }

      setHostValidationResult({
        message: data.message || "Host validated.",
        portChanges: data.portChanges || [],
        error: data.errors?.length ? data.errors.join(" ") : undefined,
      });
      toast.success("Host validation complete");
    } catch (error) {
      console.error("Failed to validate host:", error);
      setHostValidationResult({
        message: "Failed to validate host",
        portChanges: [],
        error: "Network or server error",
      });
    } finally {
      setLoading(false);
    }
  }, [composeContent, selectedHostId]);

  useEffect(() => {
    if (selectedHostId && composeContent) {
      handleValidateHost();
    }
  }, [selectedHostId, composeContent, handleValidateHost]);

  const handleFetchGitHub = useCallback(async () => {
    if (!githubUrl.trim()) return;
    setGithubLoading(true);
    setGithubError(null);
    setFetchProgress([]);
    try {
      const response = await fetch("/api/deployments/fetch-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: githubUrl.trim(), stream: true }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        setGithubError(data.error || "Failed to fetch from GitHub");
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let data: Record<string, unknown> = {};
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as { type: string; message?: string; error?: string } & Record<string, unknown>;
            if (event.type === "progress" && event.message) {
              setFetchProgress((prev) => [...prev, event.message as string]);
            } else if (event.type === "done") {
              const { type: _t, ...rest } = event;
              data = rest as Record<string, unknown>;
            } else if (event.type === "error") {
              setGithubError(event.error || "Failed to fetch from GitHub");
              setGithubDeploy(null);
              setDockerfileContent("");
              return;
            }
          } catch {
            // skip malformed line
          }
        }
      }
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer) as { type: string; message?: string; error?: string } & Record<string, unknown>;
          if (event.type === "done") {
            const { type: _t, ...rest } = event;
            data = rest as Record<string, unknown>;
          } else if (event.type === "error") {
            setGithubError(event.error || "Failed to fetch from GitHub");
            return;
          }
        } catch {
          // skip
        }
      }
      const composeContentResult = (data.composeContent as string) || "";
      setComposeContent(composeContentResult);
      setEnvContent("");
      setDockerfileContent((data.dockerfileContent as string) || "");
      if (data.cloneUrl && data.composePath) {
        setGithubDeploy({
          cloneUrl: data.cloneUrl as string,
          composePath: data.composePath as string,
          branch: data.branch as string | undefined,
        });
      } else {
        setGithubDeploy(null);
      }
      setFetchProgress((prev) => [...prev, "Done."]);
      const envRes = await fetch("/api/deployments/suggest-env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ composeContent: composeContentResult }),
      });
      if (envRes.ok) {
        const envData = await envRes.json();
        if (envData.envContent) setEnvContent(envData.envContent);
      }
    } catch (error) {
      console.error("Failed to fetch from GitHub:", error);
      setGithubError("Failed to fetch from GitHub");
      setGithubDeploy(null);
      setDockerfileContent("");
    } finally {
      setGithubLoading(false);
    }
  }, [githubUrl]);

  const fetchSuggestedEnv = useCallback(async () => {
    if (!composeContent.trim()) return;
    setEnvLoading(true);
    try {
      const response = await fetch("/api/deployments/suggest-env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ composeContent }),
      });
      if (response.ok) {
        const data = await response.json();
        setEnvContent(data.envContent || "");
      }
    } catch (error) {
      console.error("Failed to fetch suggested .env:", error);
    } finally {
      setEnvLoading(false);
    }
  }, [composeContent]);

  const handleSuggestHost = async () => {
    if (!composeContent) return;

    setLoading(true);
    setSuggestHostError(null);
    try {
      const response = await fetch("/api/deployments/suggest-host", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ composeContent }),
      });

      const data = await response.json();

      if (response.ok) {
        setRecommendation(data);
        setSelectedHostId(data.recommendedHost.hostId);
        toast.success(`Recommended host: ${data.recommendedHost.hostName}`);
      } else {
        setSuggestHostError(data.error || "Failed to get host suggestion");
        toast.error("Host suggestion failed");
      }
    } catch (error) {
      console.error("Failed to get recommendation:", error);
      setSuggestHostError("Failed to get host suggestion");
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!composeContent) return;

    setLoading(true);
    setHostValidationResult(null);
    try {
      const response = await fetch("/api/ai/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ composeContent }),
      });

      if (response.ok) {
        const data = await response.json();
        setValidationResult(data);
        if (data.result.valid) {
          toast.success("Compose file is valid");
        } else {
          toast.error("Compose file has issues");
        }
      }
    } catch (error) {
      console.error("Failed to validate:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!projectName || !selectedHostId) {
      toast.error("Please fill in project name and select a host");
      return;
    }

    const isGitHubDeploy = githubDeploy?.cloneUrl && githubDeploy?.composePath;
    if (!isGitHubDeploy && !composeContent.trim()) {
      toast.error("Please add a compose file (paste, fetch from GitHub, or generate with AI)");
      return;
    }

    setDeploying(true);
    setDeployProgress("Connecting to host…");
    try {
      if (isGitHubDeploy) {
        setDeployProgress("Cloning repository and starting containers…");
        const injectFiles: Record<string, string> = {};
        injectFiles[githubDeploy.composePath] = composeContent.trim();
        if (dockerfileContent.trim()) {
          injectFiles["Dockerfile"] = dockerfileContent.trim();
        }

        const deployResponse = await fetch("/api/deployments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostId: selectedHostId,
            projectName,
            deployFromGitHub: true,
            cloneUrl: githubDeploy.cloneUrl,
            composePath: githubDeploy.composePath,
            branch: githubDeploy.branch || undefined,
            composeContent: composeContent.trim() || undefined,
            envContent: envContent.trim() || undefined,
            injectFiles: Object.keys(injectFiles).length > 0 ? injectFiles : undefined,
          }),
        });

        if (deployResponse.ok) {
          const deployData = await deployResponse.json();
          setDeployProgress("Done.");
          
          if (deployData.autoPortFixes?.length > 0) {
            toast.success("Deployment started with automatic port remapping to avoid conflicts.");
          } else {
            toast.success("Deployment started successfully");
          }
          
          router.push("/deployments");
        } else {
          const error = await deployResponse.json();
          setDeployProgress(null);
          setErrorDialog({
            title: "Deployment Failed",
            message: error.error || "An unexpected error occurred during deployment."
          });
        }
        return;
      }

      setDeployProgress("Uploading compose and starting containers…");
      // Normal deploy: create compose file then deploy
      const fileResponse = await fetch("/api/compose-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          content: composeContent,
        }),
      });

      if (!fileResponse.ok) {
        throw new Error("Failed to save compose file");
      }

      const fileData = await fileResponse.json();

      const deployResponse = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          composeFileId: fileData.id,
          hostId: selectedHostId,
          composeContent,
          projectName,
          envContent: envContent.trim() || undefined,
        }),
      });

      if (deployResponse.ok) {
        const deployData = await deployResponse.json();
        setDeployProgress("Done.");
        
        if (deployData.autoPortFixes?.length > 0) {
          toast.success("Deployment started with automatic port remapping to avoid conflicts.");
        } else {
          toast.success("Deployment started successfully");
        }
        
        router.push("/deployments");
      } else {
        const error = await deployResponse.json();
        setDeployProgress(null);
        setErrorDialog({
          title: "Deployment Failed",
          message: error.error || "An unexpected error occurred during deployment."
        });
      }
    } catch (error) {
      console.error("Failed to deploy:", error);
      setDeployProgress(null);
      setErrorDialog({
        title: "Deployment Error",
        message: error instanceof Error ? error.message : "Network or server error"
      });
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50/50 pb-20">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <Link href="/deployments" className="hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium">
                <ArrowLeft className="h-4 w-4" />
                Back to Deployments
              </Link>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">New Deployment</h1>
            <p className="text-slate-500 max-w-2xl">
              Configure and launch a new stack. You can use AI, GitHub, or paste your own compose file.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" className="bg-white shadow-sm border-slate-200" asChild>
              <Link href="/ai">
                <Sparkles className="h-4 w-4 mr-2 text-primary" />
                AI Assistant
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Configuration */}
          <div className="lg:col-span-2 space-y-8">
            {/* Project Details */}
            <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden">
              <div className="h-1 bg-primary/80 w-full" />
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                    <Rocket className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-xl">Project Details</CardTitle>
                </div>
                <CardDescription>Give your deployment a unique name</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="project-name" className="text-xs font-bold uppercase tracking-wider text-slate-500">Project Name</Label>
                  <Input
                    id="project-name"
                    placeholder="e.g. production-api-v1"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="bg-slate-50 border-slate-200 focus:bg-white transition-all h-12 text-base font-medium"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Source Selection */}
            <Card className="border-none shadow-xl shadow-slate-200/50">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-600">
                    <FileCode className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-xl">Infrastructure Source</CardTitle>
                </div>
                <CardDescription>Fetch from GitHub or paste your compose content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* GitHub Fetch */}
                <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <Label htmlFor="github-url" className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Github className="h-3.5 w-3.5" />
                    Deploy from GitHub
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="github-url"
                      type="url"
                      placeholder="https://github.com/owner/repo"
                      value={githubUrl}
                      onChange={(e) => {
                        setGithubUrl(e.target.value);
                        setGithubError(null);
                      }}
                      className="bg-white border-slate-200 font-mono text-sm h-11"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleFetchGitHub}
                      disabled={!githubUrl.trim() || githubLoading}
                      className="h-11 px-6 shadow-sm"
                    >
                      {githubLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Fetch"
                      )}
                    </Button>
                  </div>
                  
                  <AnimatePresence>
                    {githubError && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 text-xs font-medium text-destructive bg-destructive/5 p-2 rounded-lg"
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        {githubError}
                      </motion.div>
                    )}
                    
                    {fetchProgress.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Fetch Progress</span>
                          {githubLoading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                        </div>
                        <div className="space-y-1.5">
                          {fetchProgress.map((msg, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                              <div className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                i === fetchProgress.length - 1 && githubLoading ? "bg-primary animate-pulse" : "bg-slate-300"
                              )} />
                              {msg}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Compose Editor */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Docker Compose</Label>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-[10px] uppercase font-bold tracking-wider"
                        onClick={() => copyToClipboard(composeContent)}
                        disabled={!composeContent}
                      >
                        {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="relative group">
                    <Textarea
                      placeholder="services:&#10;  web:&#10;    image: nginx:latest&#10;    ports:&#10;      - '80:80'"
                      value={composeContent}
                      onChange={(e) => {
                        setComposeContent(e.target.value);
                        setGithubDeploy(null);
                        setDockerfileContent("");
                      }}
                      className="font-mono text-sm min-h-[400px] bg-slate-900 text-slate-100 border-none rounded-xl focus-visible:ring-2 focus-visible:ring-primary/50 selection:bg-primary/30 p-4"
                    />
                    <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Badge variant="outline" className="bg-slate-800/50 text-slate-400 border-slate-700 backdrop-blur-sm">YAML</Badge>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleValidate}
                      disabled={!composeContent || loading}
                      className="rounded-full px-4"
                    >
                      Analyze Compose
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSuggestHost}
                      disabled={!composeContent || loading}
                      className="rounded-full px-4"
                    >
                      Find Best Host
                    </Button>
                  </div>
                </div>

                {/* Dockerfile Editor (Conditional) */}
                <AnimatePresence>
                  {dockerfileContent.trim().length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="space-y-3 pt-4 border-t border-slate-100"
                    >
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Generated Dockerfile</Label>
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">AI Generated</Badge>
                      </div>
                      <Textarea
                        placeholder="Dockerfile content..."
                        value={dockerfileContent}
                        onChange={(e) => setDockerfileContent(e.target.value)}
                        className="font-mono text-sm min-h-[200px] bg-slate-800 text-slate-200 border-none rounded-xl p-4"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Environment Variables */}
            <AnimatePresence>
              {composeContent.trim() && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="border-none shadow-xl shadow-slate-200/50">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600">
                            <Settings2 className="h-4 w-4" />
                          </div>
                          <CardTitle className="text-xl">Environment Variables</CardTitle>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={fetchSuggestedEnv}
                          disabled={!composeContent.trim() || envLoading}
                          className="text-xs font-bold uppercase tracking-wider"
                        >
                          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", envLoading && "animate-spin")} />
                          {envLoading ? "Generating…" : "Regenerate"}
                        </Button>
                      </div>
                      <CardDescription>Configure variables for your stack</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        id="env-content"
                        placeholder="KEY=VALUE"
                        value={envContent}
                        onChange={(e) => setEnvContent(e.target.value)}
                        className="font-mono text-sm min-h-[200px] bg-slate-50 border-slate-200 rounded-xl p-4"
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Host & Summary */}
          <div className="space-y-8">
            {/* Host Selection */}
            <Card className="border-none shadow-xl shadow-slate-200/50 sticky top-24">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600">
                    <Server className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-xl">Target Host</CardTitle>
                </div>
                <CardDescription>Select where to deploy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* AI Recommendation */}
                <AnimatePresence>
                  {recommendation && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <Badge className="bg-primary text-primary-foreground shadow-sm">Recommended</Badge>
                        <div className="text-xs font-bold text-primary">{recommendation.recommendedHost.score}% Match</div>
                      </div>
                      <div className="font-bold text-slate-900">{recommendation.recommendedHost.hostName}</div>
                      <div className="space-y-1.5">
                        {recommendation.recommendedHost.reasons.map((reason, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                            {reason}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Select Host</Label>
                  <select
                    className="flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-base font-medium transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none appearance-none"
                    value={selectedHostId}
                    onChange={(e) => {
                      const newHostId = e.target.value;
                      setSelectedHostId(newHostId);
                      setHostValidationResult(null);
                    }}
                  >
                    <option value="">Choose a host...</option>
                    {hosts.map((host) => (
                      <option key={host.id} value={host.id}>
                        {host.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  variant="secondary"
                  className="w-full h-11 rounded-xl shadow-sm"
                  onClick={handleValidateHost}
                  disabled={!composeContent || !selectedHostId || loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings2 className="h-4 w-4 mr-2" />}
                  Validate Host Ports
                </Button>

                <AnimatePresence>
                  {hostValidationResult && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className={cn(
                        "rounded-xl p-4 text-sm border",
                        hostValidationResult.error
                          ? "bg-destructive/5 border-destructive/20 text-destructive"
                          : "bg-emerald-50 border-emerald-100 text-emerald-700"
                      )}
                    >
                      <div className="flex items-center gap-2 font-bold mb-2">
                        {hostValidationResult.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        {hostValidationResult.message}
                      </div>
                      {hostValidationResult.portChanges.length > 0 && (
                        <div className="space-y-2 mt-2 pt-2 border-t border-emerald-200/50">
                          <p className="text-xs font-bold uppercase tracking-wider opacity-70">Port Adjustments</p>
                          {hostValidationResult.portChanges.map((c, i) => (
                            <div key={i} className="flex items-center justify-between text-xs font-mono bg-white/50 p-1.5 rounded">
                              <span>{c.serviceName}</span>
                              <div className="flex items-center gap-2">
                                <span className="line-through opacity-50">{c.from}</span>
                                <ChevronRight className="h-3 w-3" />
                                <span className="font-bold">{c.to}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
              <CardFooter className="bg-slate-50/50 border-t border-slate-100 p-6 flex flex-col gap-4">
                <div className="w-full space-y-3">
                  {deployProgress && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 text-sm text-primary font-medium animate-in fade-in slide-in-from-bottom-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {deployProgress}
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 h-12 rounded-xl bg-white" asChild>
                      <Link href="/deployments">Cancel</Link>
                    </Button>
                    <Button
                      className="flex-[2] h-12 rounded-xl shadow-lg shadow-primary/20 text-base font-bold"
                      onClick={handleDeploy}
                      disabled={
                        !projectName ||
                        !selectedHostId ||
                        deploying ||
                        (!githubDeploy && !composeContent.trim())
                      }
                    >
                      {deploying ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      ) : (
                        <Rocket className="h-5 w-5 mr-2" />
                      )}
                      {githubDeploy ? "Deploy from GitHub" : "Launch Stack"}
                    </Button>
                  </div>
                </div>
                
                {githubDeploy && (
                  <div className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                    <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <p>
                      This project will be cloned from <span className="font-mono text-slate-700">{githubDeploy.cloneUrl}</span>. 
                      {dockerfileContent.trim() ? " AI-generated build artifacts will be injected." : " The existing Dockerfile/Compose will be used."}
                    </p>
                  </div>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>

      {/* Error Dialog */}
      <Dialog open={!!errorDialog} onOpenChange={(open) => !open && setErrorDialog(null)}>
        <DialogContent className="sm:max-w-2xl rounded-2xl border-none shadow-2xl">
          <DialogHeader>
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl font-bold text-slate-900">{errorDialog?.title}</DialogTitle>
            <DialogDescription className="text-slate-500 text-base">
              The deployment could not be completed. Review the error details below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Error Details</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-[10px] uppercase font-bold"
                onClick={() => errorDialog && copyToClipboard(errorDialog.message)}
              >
                <Copy className="h-3 w-3 mr-1.5" />
                Copy Error
              </Button>
            </div>
            <ScrollArea className="h-[200px] w-full rounded-xl bg-slate-950 p-4 border border-slate-800">
              <code className="text-xs font-mono text-red-400 whitespace-pre-wrap leading-relaxed">
                {errorDialog?.message}
              </code>
            </ScrollArea>
          </div>

          <DialogFooter className="mt-6">
            <Button 
              className="w-full h-12 rounded-xl font-bold" 
              onClick={() => setErrorDialog(null)}
            >
              Close and Adjust Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analysis Result Dialog */}
      <Dialog open={!!validationResult} onOpenChange={(open) => !open && setValidationResult(null)}>
        <DialogContent className="sm:max-w-2xl rounded-2xl border-none shadow-2xl">
          <DialogHeader>
            <div className={cn(
              "h-12 w-12 rounded-full flex items-center justify-center mb-4",
              validationResult?.result.valid ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
            )}>
              {validationResult?.result.valid ? <CheckCircle2 className="h-6 w-6" /> : <Info className="h-6 w-6" />}
            </div>
            <DialogTitle className="text-2xl font-bold text-slate-900">
              {validationResult?.result.valid ? "Analysis Complete" : "Issues Found"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-base">
              AI analysis of your Docker Compose configuration.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Summary</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-[10px] uppercase font-bold"
                onClick={() => validationResult && copyToClipboard(validationResult.summary)}
              >
                <Copy className="h-3 w-3 mr-1.5" />
                Copy
              </Button>
            </div>
            <ScrollArea className="h-[300px] w-full rounded-xl bg-slate-50 p-6 border border-slate-200">
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                {validationResult?.summary}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="mt-6">
            <Button 
              className="w-full h-12 rounded-xl font-bold" 
              onClick={() => setValidationResult(null)}
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
