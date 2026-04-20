"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrainingConfigForm } from "@/components/training/training-config-form";
import { Button } from "@/components/ui/button";
import { canTrainModels, getCurrentUserRole, Role } from "@/lib/permissions";
import { getUserOrgId } from "@/lib/supabase";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";

export default function TrainingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const { data: { session } } = await await import("@/lib/supabase").then(m => m.supabase.auth.getSession());
        if (!session?.user) {
          router.push("/login");
          return;
        }

        const userOrgId = await getUserOrgId(session.user.id);
        if (!userOrgId) {
          router.push("/login");
          return;
        }

        const userRole = await getCurrentUserRole(userOrgId);
        setRole(userRole);

        if (!userRole || !canTrainModels(userRole)) {
          setHasPermission(false);
        } else {
          setHasPermission(true);
        }
      } catch (err) {
        console.error("Failed to check permissions:", err);
        setHasPermission(false);
      } finally {
        setLoading(false);
      }
    };

    checkPermission();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-destructive/10 p-4">
              <ShieldAlert className="h-12 w-12 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
          <p className="text-muted-foreground mt-2">
            You need Admin or higher role to access training configuration.
            {role && <span className="block mt-1">Your current role: <strong className="capitalize">{role}</strong></span>}
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="mt-6"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mb-4 pl-0">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Training Configuration</h1>
        <p className="text-muted-foreground mt-1">
          Configure and launch ML training jobs for your signals
        </p>
      </div>

      <TrainingConfigForm />
    </div>
  );
}