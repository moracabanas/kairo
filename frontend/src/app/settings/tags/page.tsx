"use client";

import { useState, useEffect } from "react";
import { TagManager } from "@/components/labels/tag-manager";
import { Loader2 } from "lucide-react";
import { getUserOrgId } from "@/lib/supabase";

export default function TagsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOrgId = async () => {
      try {
        const { data: { session } } = await import("@/lib/supabase").then(m => m.supabase.auth.getSession());
        if (session?.user) {
          const userOrgId = await getUserOrgId(session.user.id);
          setOrgId(userOrgId);
        } else {
          setError("Not authenticated");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load organization");
      } finally {
        setLoading(false);
      }
    };
    loadOrgId();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (error || !orgId) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error || "No organization found"}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Label Tags</h1>
        <p className="text-muted-foreground mt-1">
          Manage tags to categorize and label your signal data
        </p>
      </div>

      <TagManager orgId={orgId} />
    </div>
  );
}
