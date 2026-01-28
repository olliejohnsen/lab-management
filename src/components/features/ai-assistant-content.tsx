"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Sparkles, 
  Copy, 
  Download, 
  Rocket, 
  User, 
  Bot, 
  Loader2, 
  Check, 
  ChevronRight,
  Lightbulb,
  FileCode,
  Terminal,
  Zap,
  Database,
  Globe as GlobeIcon
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
  isCompose?: boolean;
}

export function AIAssistantContent() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [generatedCompose, setGeneratedCompose] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleGenerate = async (customPrompt?: string) => {
    const activePrompt = customPrompt || prompt;
    if (!activePrompt.trim()) return;

    const userMessage: Message = { role: "user", content: activePrompt };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setPrompt("");

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: activePrompt }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedCompose(data.composeContent);
        
        const assistantMessage: Message = {
          role: "assistant",
          content: data.composeContent,
          isCompose: true
        };
        setMessages((prev) => [...prev, assistantMessage]);
        toast.success("Infrastructure generated!");
      } else {
        const error = await response.json();
        toast.error(`Generation failed: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to generate:", error);
      toast.error("Failed to generate compose file");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedCompose], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "docker-compose.yml";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeploy = (content: string) => {
    sessionStorage.setItem("compose-content", content);
    router.push("/deployments/new");
  };

  const examples = [
    { title: "Database", prompt: "Give me a docker compose for postgres with pgAdmin", icon: Database },
    { title: "AI Stack", prompt: "I want to spin up Langflow with a vector db", icon: Sparkles },
    { title: "Web Server", prompt: "Create a compose for nginx with SSL and a hello world page", icon: GlobeIcon },
    { title: "Caching", prompt: "Deploy Redis with persistence and a dashboard", icon: Zap },
  ];

  return (
    <div className="min-h-full bg-slate-50/50 pb-20">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              <div className="p-2 rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-8 w-8" />
              </div>
              AI Assistant
            </h1>
            <p className="text-slate-500 max-w-2xl font-medium mt-1">
              Describe your infrastructure in plain English and let the AI build your Docker Compose files.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Chat Area */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-none shadow-xl shadow-slate-200/50 flex flex-col h-[700px] overflow-hidden bg-white">
              <CardHeader className="border-b border-slate-50 py-4 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">AI Architect Online</span>
                  </div>
                  <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-200">Ollama / Llama 3.2</Badge>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
                <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                  <div className="space-y-8">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                        <div className="h-24 w-24 rounded-3xl bg-primary/5 flex items-center justify-center">
                          <Bot className="h-12 w-12 text-primary/40" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-extrabold text-slate-900">How can I help you build today?</h3>
                          <p className="text-slate-500 max-w-sm mx-auto font-medium">
                            I can generate complex Docker Compose stacks, set up networks, and configure persistent storage.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                          {examples.map((ex, i) => (
                            <button
                              key={i}
                              onClick={() => handleGenerate(ex.prompt)}
                              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 hover:border-primary/30 hover:shadow-md transition-all text-left group"
                            >
                              <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-primary/10 text-slate-400 group-hover:text-primary transition-colors">
                                <ex.icon className="h-4 w-4" />
                              </div>
                              <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900">{ex.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {messages.map((message, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex gap-4",
                          message.role === "user" ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        <div className={cn(
                          "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                          message.role === "user" ? "bg-slate-900 text-white" : "bg-primary text-primary-foreground"
                        )}>
                          {message.role === "user" ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                        </div>
                        <div className={cn(
                          "max-w-[85%] space-y-2",
                          message.role === "user" ? "items-end" : "items-start"
                        )}>
                          {message.isCompose ? (
                            <div className="space-y-3">
                              <div className="rounded-2xl bg-slate-900 text-slate-100 p-1 shadow-2xl overflow-hidden border border-slate-800">
                                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
                                  <div className="flex items-center gap-2">
                                    <FileCode className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">docker-compose.yml</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 text-slate-400 hover:text-white"
                                      onClick={() => handleCopy(message.content)}
                                    >
                                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    </Button>
                                  </div>
                                </div>
                                <pre className="p-4 font-mono text-xs overflow-x-auto leading-relaxed scrollbar-hide">
                                  {message.content}
                                </pre>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  className="rounded-xl font-bold h-9 shadow-lg shadow-primary/20"
                                  onClick={() => handleDeploy(message.content)}
                                >
                                  <Rocket className="h-3.5 w-3.5 mr-2" />
                                  Deploy Stack
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="rounded-xl font-bold h-9 bg-white"
                                  onClick={handleDownload}
                                >
                                  <Download className="h-3.5 w-3.5 mr-2" />
                                  Download
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className={cn(
                              "rounded-2xl px-4 py-3 text-sm font-medium shadow-sm",
                              message.role === "user" 
                                ? "bg-slate-900 text-white rounded-tr-none" 
                                : "bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200"
                            )}>
                              {message.content}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}

                    {loading && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-4"
                      >
                        <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 animate-pulse">
                          <Bot className="h-5 w-5" />
                        </div>
                        <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-3 border border-slate-200 shadow-sm">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider animate-pulse">Architecting...</span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </ScrollArea>

                <div className="p-6 bg-white border-t border-slate-100">
                  <div className="relative flex items-center">
                    <Input
                      placeholder="Describe your infrastructure (e.g. 'Postgres with Redis and a Node.js frontend')..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !loading) {
                          handleGenerate();
                        }
                      }}
                      disabled={loading}
                      className="pr-14 h-14 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium"
                    />
                    <Button
                      size="icon"
                      onClick={() => handleGenerate()}
                      disabled={!prompt.trim() || loading}
                      className="absolute right-2 h-10 w-10 rounded-xl shadow-lg shadow-primary/20"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                  <p className="mt-3 text-[10px] text-center font-bold uppercase tracking-widest text-slate-400">
                    Powered by Ollama Local Intelligence
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: Tips & History */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-xl shadow-slate-200/50 bg-white overflow-hidden">
              <div className="h-1 bg-amber-400 w-full" />
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-lg font-bold">Pro Tips</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { title: "Persistence", desc: "Mention if you need volumes for your databases." },
                  { title: "Networking", desc: "Ask for specific network configurations if needed." },
                  { title: "Environment", desc: "Specify required environment variables for your apps." },
                  { title: "Versions", desc: "You can request specific image tags like 'postgres:16-alpine'." }
                ].map((tip, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                    <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors shrink-0">{i+1}</div>
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-900">{tip.title}</div>
                      <div className="text-[11px] text-slate-500 font-medium leading-relaxed">{tip.desc}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl shadow-slate-200/50 bg-slate-900 text-white overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-md bg-white/10 text-white">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 p-4">
                <Button variant="ghost" className="w-full justify-start text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 h-10 rounded-lg">
                  <ChevronRight className="h-3 w-3 mr-2 text-primary" />
                  Clear Conversation
                </Button>
                <Button variant="ghost" className="w-full justify-start text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 h-10 rounded-lg">
                  <ChevronRight className="h-3 w-3 mr-2 text-primary" />
                  View Generated History
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Globe({ className }: { className?: string }) {
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
      className={className}
    >
      <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/><path d="M2 12h20"/>
    </svg>
  );
}
