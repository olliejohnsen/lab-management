"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Server, 
  Plus, 
  Trash2, 
  TestTube, 
  Settings2, 
  Sparkles, 
  Users, 
  Activity, 
  Shield, 
  Cpu, 
  HardDrive, 
  Network,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Circle,
  Key,
  Database,
  Terminal
} from "lucide-react";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
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

interface Host {
  id: string;
  name: string;
  host: string;
  port: number;
  connectionType: string;
  isActive: boolean;
}

export function SettingsContent() {
  return (
    <div className="min-h-full bg-slate-50/50 pb-20">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Settings</h1>
          <p className="text-slate-500 max-w-2xl font-medium mt-1">
            Configure your DEV infrastructure, AI models, and system preferences.
          </p>
        </div>

        <Tabs defaultValue="hosts" className="space-y-8">
          <TabsList className="bg-white border p-1 rounded-xl shadow-sm h-12">
            <TabsTrigger value="hosts" className="rounded-lg px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Server className="h-4 w-4 mr-2" />
              Docker Hosts
            </TabsTrigger>
            <TabsTrigger value="placement" className="rounded-lg px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Activity className="h-4 w-4 mr-2" />
              Placement
            </TabsTrigger>
            <TabsTrigger value="ai" className="rounded-lg px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Sparkles className="h-4 w-4 mr-2" />
              AI Config
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent key="hosts" value="hosts">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <DockerHostsSettings />
              </motion.div>
            </TabsContent>

            <TabsContent key="placement" value="placement">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <PlacementSettings />
              </motion.div>
            </TabsContent>

            <TabsContent key="ai" value="ai">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <AISettings />
              </motion.div>
            </TabsContent>

            <TabsContent key="users" value="users">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <UsersSettings />
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}

function DockerHostsSettings() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    host: "",
    port: "22",
    connectionType: "SSH",
    username: "",
    password: "",
  });

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
    }
  };

  const handleAdd = async () => {
    if (!formData.name || !formData.host) {
      toast.error("Name and Host are required");
      return;
    }

    setLoading(true);
    try {
      const credentials = {
        username: formData.username,
        password: formData.password,
      };

      const response = await fetch("/api/hosts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          host: formData.host,
          port: parseInt(formData.port),
          connectionType: formData.connectionType,
          credentials,
        }),
      });

      if (response.ok) {
        toast.success("Host added successfully");
        fetchHosts();
        setShowAddForm(false);
        setFormData({ name: "", host: "", port: "22", connectionType: "SSH", username: "", password: "" });
      } else {
        const error = await response.json();
        toast.error(`Failed to add host: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to add host:", error);
      toast.error("Network error while adding host");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const response = await fetch(`/api/hosts/${deleteId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Host removed");
        fetchHosts();
      } else {
        toast.error("Failed to remove host");
      }
    } catch (error) {
      console.error("Failed to delete host:", error);
      toast.error("Network error");
    } finally {
      setDeleteId(null);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const response = await fetch(`/api/hosts/${id}/test`, {
        method: "POST",
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast.success(data.message || "Connection successful");
      } else {
        toast.error(data.message || "Connection failed");
      }
    } catch (error) {
      console.error("Failed to test connection:", error);
      toast.error("Network error during test");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="h-1 bg-primary w-full" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
          <div>
            <CardTitle className="text-2xl font-bold">Docker Hosts</CardTitle>
            <CardDescription>Manage connections to your DEV servers</CardDescription>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="rounded-xl font-bold">
            {showAddForm ? "Cancel" : <><Plus className="h-4 w-4 mr-2" /> Add Host</>}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 space-y-6 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Display Name</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Raspberry Pi 5"
                        className="bg-white border-slate-200 h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Connection Type</Label>
                      <select
                        className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                        value={formData.connectionType}
                        onChange={(e) => setFormData({ ...formData, connectionType: e.target.value })}
                      >
                        <option value="SSH">SSH (Recommended)</option>
                        <option value="API">Docker API (TCP)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Host / IP Address</Label>
                      <Input
                        value={formData.host}
                        onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                        placeholder="192.168.1.100"
                        className="bg-white border-slate-200 h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Port</Label>
                      <Input
                        value={formData.port}
                        onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                        placeholder="22"
                        className="bg-white border-slate-200 h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Username</Label>
                      <Input
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="administrator"
                        className="bg-white border-slate-200 h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Password / Sudo Password</Label>
                      <Input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="bg-white border-slate-200 h-11"
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-[11px] text-blue-700 leading-relaxed">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <p>Credentials are used for SSH login and for executing Docker commands with sudo if the user is not in the docker group.</p>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setShowAddForm(false)} className="font-bold">Cancel</Button>
                    <Button onClick={handleAdd} disabled={loading} className="rounded-xl px-8 font-bold shadow-lg shadow-primary/20">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      Save Host
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 gap-4">
            {hosts.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-2xl space-y-3">
                <Server className="h-10 w-10 text-slate-200 mx-auto" />
                <p className="text-slate-400 font-medium">No hosts configured yet</p>
              </div>
            ) : (
              hosts.map((host) => (
                <Card key={host.id} className="border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "p-2.5 rounded-xl transition-colors",
                        host.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                      )}>
                        <Server className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{host.name}</span>
                          <Badge variant={host.isActive ? "success" : "secondary"} className="text-[10px] h-5 px-1.5 font-bold uppercase tracking-tight">
                            {host.isActive ? "Online" : "Offline"}
                          </Badge>
                        </div>
                        <div className="text-xs font-medium text-slate-500 mt-0.5 flex items-center gap-2">
                          <span className="font-mono">{host.host}:{host.port}</span>
                          <div className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>{host.connectionType}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-9 font-bold border-slate-200"
                        onClick={() => handleTest(host.id)}
                        disabled={testingId === host.id}
                      >
                        {testingId === host.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                        ) : (
                          <TestTube className="h-3.5 w-3.5 mr-2 text-primary" />
                        )}
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg h-9 font-bold text-destructive hover:bg-destructive/5 hover:text-destructive"
                        onClick={() => setDeleteId(host.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
              <Trash2 className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold text-slate-900">Remove Host?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-base leading-relaxed">
              This will remove the connection to this host. Existing deployments on this host will continue to run but will no longer be managed by this system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl h-12 font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="rounded-xl h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold shadow-lg shadow-destructive/20"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              Confirm Removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PlacementSettings() {
  const [weights, setWeights] = useState({ cpu: 30, ram: 30, disk: 20, network: 20 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        if (data.placement_weights) {
          setWeights(data.placement_weights);
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "placement_weights",
          value: weights,
        }),
      });

      if (response.ok) {
        toast.success("Placement weights updated");
      } else {
        toast.error("Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  const total = weights.cpu + weights.ram + weights.disk + weights.network;

  const WeightSlider = ({ label, value, icon: Icon, onChange }: { label: string, value: number, icon: any, onChange: (val: number) => void }) => (
    <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <Label className="text-sm font-bold text-slate-700">{label}</Label>
        </div>
        <Badge variant="outline" className="bg-white font-mono font-bold text-primary border-primary/20">
          {value}%
        </Badge>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  );

  return (
    <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden">
      <div className="h-1 bg-emerald-500 w-full" />
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Placement Logic</CardTitle>
        <CardDescription>
          Tune how the system selects the best host for new deployments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WeightSlider 
            label="CPU Availability" 
            value={weights.cpu} 
            icon={Cpu}
            onChange={(val) => setWeights({ ...weights, cpu: val })} 
          />
          <WeightSlider 
            label="RAM Availability" 
            value={weights.ram} 
            icon={Activity}
            onChange={(val) => setWeights({ ...weights, ram: val })} 
          />
          <WeightSlider 
            label="Disk Space" 
            value={weights.disk} 
            icon={HardDrive}
            onChange={(val) => setWeights({ ...weights, disk: val })} 
          />
          <WeightSlider 
            label="Network Capacity" 
            value={weights.network} 
            icon={Network}
            onChange={(val) => setWeights({ ...weights, network: val })} 
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-3 w-3 rounded-full animate-pulse",
              total === 100 ? "bg-emerald-400" : "bg-rose-400"
            )} />
            <div>
              <div className="text-sm font-bold">Total Weight: {total}%</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Must equal 100%</div>
            </div>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={total !== 100 || loading}
            className="bg-white text-slate-900 hover:bg-slate-100 font-bold rounded-xl px-6"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Logic"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AISettings() {
  const [model, setModel] = useState("llama3.2");
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchModels();
    fetchSettings();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch("/api/ai/models");
      if (response.ok) {
        const data = await response.json();
        setModels(data.models);
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        if (data.ollama_model) {
          setModel(data.ollama_model.model);
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "ollama_model",
          value: { model },
        }),
      });

      if (response.ok) {
        toast.success("AI configuration saved");
      } else {
        toast.error("Failed to save AI config");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden">
      <div className="h-1 bg-primary w-full" />
      <CardHeader>
        <CardTitle className="text-2xl font-bold">AI Configuration</CardTitle>
        <CardDescription>
          Select the model used for generating infrastructure
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3 p-6 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <Label className="text-sm font-bold text-slate-900">Ollama Model</Label>
              <p className="text-[11px] text-slate-500 font-medium">Local LLM for Docker Compose generation</p>
            </div>
          </div>
          
          <select
            className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-base font-medium transition-all focus:ring-2 focus:ring-primary/20 outline-none appearance-none"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading} className="rounded-xl px-8 font-bold shadow-lg shadow-primary/20 h-11">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Save AI Config
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UsersSettings() {
  return (
    <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden">
      <div className="h-1 bg-slate-900 w-full" />
      <CardHeader>
        <CardTitle className="text-2xl font-bold">User Management</CardTitle>
        <CardDescription>
          Manage access and permissions for your DEV environment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-16 space-y-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
            <Shield className="h-8 w-8 text-slate-300" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-slate-900">Advanced Access Control</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">
              Multi-user support and role-based access control is currently in development.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full px-4 py-1 font-bold uppercase tracking-widest text-[10px]">
            Coming Soon
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
