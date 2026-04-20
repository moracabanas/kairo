"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  Organization,
  OrgUsage,
  OrgAdmin,
  getOrganization,
  updateOrganization,
  getOrganizationUsage,
  listOrgAdmins,
  transferOwnership,
} from "@/lib/supabase";

export default function OrganizationSettingsPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [usage, setUsage] = useState<OrgUsage | null>(null);
  const [admins, setAdmins] = useState<OrgAdmin[]>([]);
  const [orgName, setOrgName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [orgId] = useState<string>("demo-org-id");

  async function loadOrganizationData() {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setError("Not authenticated");
        setIsLoading(false);
        return;
      }

      const [orgData, usageData, adminsData] = await Promise.all([
        getOrganization(orgId),
        getOrganizationUsage(orgId),
        listOrgAdmins(orgId),
      ]);

      setOrganization(orgData);
      setUsage(usageData);
      setAdmins(adminsData);
      setOrgName(orgData?.name || "");
      setIsOwner(adminsData.some(a => a.id === session.user.id && a.role === "owner"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organization data");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrganizationData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function handleUpdateName(e: React.FormEvent) {
    e.preventDefault();
    if (!organization) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await updateOrganization(organization.id, orgName);
      setOrganization(updated);
      setSuccessMessage("Organization name updated successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update organization name");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTransferOwnership(newOwnerId: string) {
    if (!organization) return;

    if (!confirm("Are you sure you want to transfer ownership? This action cannot be undone.")) {
      return;
    }

    setIsTransferring(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await transferOwnership(organization.id, newOwnerId);
      setSuccessMessage("Ownership transferred successfully. You are now an admin.");
      await loadOrganizationData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transfer ownership");
    } finally {
      setIsTransferring(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Organization Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your organization details and settings
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-6">
          {successMessage}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Organization Name</CardTitle>
          <CardDescription>Update your organization&apos;s display name</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateName} className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="org-name" className="sr-only">
                Organization Name
              </Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Enter organization name"
                disabled={!isOwner}
              />
            </div>
            <Button type="submit" disabled={isSaving || !isOwner}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Plan & Usage</CardTitle>
            <CardDescription>Your current plan and resource usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Current Plan</span>
              <span className="font-medium capitalize">{organization?.plan || "Free"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Signals</span>
              <span className="font-medium">{usage?.signal_count || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Team Members</span>
              <span className="font-medium">{usage?.user_count || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organization Info</CardTitle>
            <CardDescription>Details about your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Organization ID</span>
              <span className="font-mono text-xs">{organization?.id || "N/A"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="font-medium">
                {organization?.created_at ? new Date(organization.created_at).toLocaleDateString() : "N/A"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Last Updated</span>
              <span className="font-medium">
                {organization?.updated_at ? new Date(organization.updated_at).toLocaleDateString() : "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Transfer Ownership</CardTitle>
            <CardDescription>
              Transfer ownership to another admin. The new owner must be an admin of the organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {admins.filter(a => a.role === "admin").length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You need at least one admin to transfer ownership.
              </p>
            ) : (
              <div className="space-y-4">
                {admins
                  .filter((admin) => admin.role === "admin")
                  .map((admin) => (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">{admin.email}</p>
                        <p className="text-sm text-muted-foreground">Admin</p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handleTransferOwnership(admin.id)}
                        disabled={isTransferring}
                      >
                        {isTransferring ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Transferring...
                          </>
                        ) : (
                          "Transfer Ownership"
                        )}
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Ownership Transfer</CardTitle>
            <CardDescription>
              Only the current owner can transfer ownership. Contact your organization&apos;s owner to
              request ownership transfer.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}