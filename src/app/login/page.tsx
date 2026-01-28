"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, ShieldCheck, Lock, Mail, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordChanged = searchParams.get("passwordChanged") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (passwordChanged) {
      toast.success("Password updated! Please sign in again.");
    }
  }, [passwordChanged]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid credentials. Please try again.");
      } else {
        toast.success("Signed in successfully!");
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      toast.error("An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Email Address</Label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
            <Mail className="h-4 w-4" />
          </div>
          <Input
            id="email"
            type="email"
            placeholder="admin@storio.dev"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="pl-11 h-12 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all font-medium"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between ml-1">
          <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</Label>
          <button type="button" className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">Forgot?</button>
        </div>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
            <Lock className="h-4 w-4" />
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="pl-11 h-12 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all font-medium"
          />
        </div>
      </div>

      <Button 
        type="submit" 
        className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/20 mt-2" 
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Authenticating...
          </>
        ) : (
          <>
            Sign In to Dashboard
            <ArrowRight className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden p-4">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-[440px] z-10"
      >
        <div className="flex flex-col items-center mb-8 space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/40">
            <Server className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black text-white tracking-tight">DEV Manager</h1>
            <p className="text-slate-400 font-medium">Enterprise Infrastructure Control</p>
          </div>
        </div>

        <Card className="border-none shadow-2xl bg-white/95 backdrop-blur-xl overflow-hidden rounded-[2rem]">
          <div className="h-1.5 bg-primary w-full" />
          <CardHeader className="space-y-1 pb-8 pt-8 px-8">
            <CardTitle className="text-2xl font-black text-slate-900">Welcome Back</CardTitle>
            <CardDescription className="text-slate-500 font-medium text-base">
              Sign in to manage your DEV infrastructure.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <Suspense fallback={
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
        
        <div className="mt-8 flex items-center gap-6 justify-center text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Secure Access</span>
          </div>
          <div className="h-1 w-1 rounded-full bg-slate-700" />
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest">System Online</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
