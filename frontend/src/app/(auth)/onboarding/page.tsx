"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const supabase = getSupabaseClient();
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      if (!sessionUser) {
        router.push("/login");
        return;
      }
      setUser(sessionUser);
    };
    checkUser();
  }, [router]);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      setError("Organization name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabase = getSupabaseClient();

      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      if (!sessionUser) {
        router.push("/login");
        return;
      }

      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({ name: orgName })
        .select()
        .single();

      if (orgError) {
        throw orgError;
      }

      const { error: userError } = await supabase
        .from("users")
        .update({ org_id: org.id, role: "owner" })
        .eq("id", sessionUser.id);

      if (userError) {
        throw userError;
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("Onboarding error:", err);
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create Your Organization</CardTitle>
          <CardDescription>
            You need to create an organization to use Kairo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              placeholder="My Organization"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button
            className="w-full"
            onClick={handleCreateOrg}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Organization"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
