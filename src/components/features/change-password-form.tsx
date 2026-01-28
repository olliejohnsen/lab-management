"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Key, ShieldCheck, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface ChangePasswordFormProps {
  userId: string;
  userEmail: string;
}

export function ChangePasswordForm({ userId, userEmail }: ChangePasswordFormProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to change password");
        return;
      }

      toast.success("Password changed successfully");

      // Sign in with new password to get a fresh session (mustChangePassword: false)
      const signInResult = await signIn("credentials", {
        email: userEmail,
        password: newPassword,
        redirect: false,
      });

      if (signInResult?.ok) {
        toast.success("Welcome back!");
        router.push("/dashboard");
        router.refresh();
      } else {
        // Password was changed but re-login failed; redirect anyway so they can log in
        router.push("/login?passwordChanged=1");
        router.refresh();
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <Card className="border-none shadow-2xl shadow-slate-200/50 overflow-hidden">
        <div className="h-1.5 bg-primary w-full" />
        <CardHeader className="space-y-1 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-black text-slate-900">Security Update</CardTitle>
          </div>
          <CardDescription className="text-slate-500 font-medium">
            Please update your password to continue using the DEV Management System.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="current-password" className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-slate-50 border-slate-200 h-12 pl-4 focus:bg-white transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <div className="h-[1px] bg-slate-100 my-2" />

            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-xs font-bold uppercase tracking-wider text-slate-500">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-slate-50 border-slate-200 h-12 pl-4 focus:bg-white transition-all"
                placeholder="Minimum 8 characters"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-xs font-bold uppercase tracking-wider text-slate-500">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-slate-50 border-slate-200 h-12 pl-4 focus:bg-white transition-all"
                placeholder="Repeat new password"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/20 mt-4" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Updating Security...
                </>
              ) : (
                <>
                  Update Password
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <div className="mt-8 flex items-center gap-2 justify-center text-slate-400">
        <Key className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-widest">End-to-End Encrypted</span>
      </div>
    </motion.div>
  );
}
