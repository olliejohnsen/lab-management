import { requireAuth } from "@/lib/auth-utils";
import { ChangePasswordForm } from "@/components/features/change-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ChangePasswordPage() {
  const session = await requireAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Change Password</CardTitle>
          <CardDescription>
            {session.user.mustChangePassword
              ? "You must change your password before continuing"
              : "Update your password"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm userId={session.user.id} userEmail={session.user.email ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
