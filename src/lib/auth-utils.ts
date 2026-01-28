import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Get the current session or redirect to login
 */
export async function requireAuth() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }
  
  return session;
}

/**
 * Require admin access or redirect to dashboard
 */
export async function requireAdmin() {
  const session = await requireAuth();
  
  if (!session.user.isAdmin) {
    redirect("/dashboard");
  }
  
  return session;
}

/**
 * Check if user must change password and redirect if needed
 */
export async function checkPasswordChange() {
  const session = await auth();
  
  if (session?.user && session.user.mustChangePassword) {
    redirect("/change-password");
  }
  
  return session;
}
