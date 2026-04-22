import { getSupabaseClient } from "./supabase/client";

// Re-export the browser client singleton for backwards compatibility
export const supabase = getSupabaseClient();

export function getSupabase() {
  return getSupabaseClient();
}

export interface OrgUser {
  id: string;
  email: string;
  role: "owner" | "admin" | "analyst" | "viewer";
  org_id: string;
  created_at: string;
}

export async function listOrgUsers(orgId: string): Promise<OrgUser[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("users", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "list", org_id: orgId },
  });

  if (error) throw error;
  return data.data || [];
}

export async function inviteUser(orgId: string, email: string, role: string): Promise<OrgUser> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("users", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "invite", org_id: orgId, email, role },
  });

  if (error) throw error;
  return data.data;
}

export async function updateUserRole(userId: string, newRole: string): Promise<OrgUser> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("users", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "update_role", user_id: userId, new_role: newRole },
  });

  if (error) throw error;
  return data.data;
}

export async function removeUser(userId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { error } = await supabase.functions.invoke("users", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "remove", user_id: userId },
  });

  if (error) throw error;
}

export async function getUserOrgId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data?.org_id || null;
}

export interface Organization {
  id: string;
  name: string;
  plan: string;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgUsage {
  user_count: number;
  signal_count: number;
  storage_estimate_mb: number;
}

export interface OrgAdmin {
  id: string;
  email: string;
  role: string;
}

export async function getOrganization(orgId: string): Promise<Organization> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("orgs", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "get", org_id: orgId },
  });

  if (error) throw error;
  return data.data;
}

export async function updateOrganization(orgId: string, name: string): Promise<Organization> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("orgs", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "update", org_id: orgId, name },
  });

  if (error) throw error;
  return data.data;
}

export async function getOrganizationUsage(orgId: string): Promise<OrgUsage> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("orgs", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "usage", org_id: orgId },
  });

  if (error) throw error;
  return data.data;
}

export async function listOrgAdmins(orgId: string): Promise<OrgAdmin[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("orgs", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "admins", org_id: orgId },
  });

  if (error) throw error;
  return data.data || [];
}

export async function transferOwnership(orgId: string, newOwnerUserId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { error } = await supabase.functions.invoke("orgs", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "transfer", org_id: orgId, new_owner_user_id: newOwnerUserId },
  });

  if (error) throw error;
}

export interface LabelTag {
  id: string;
  org_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

export async function listLabelTags(orgId: string): Promise<LabelTag[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("label-tags", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "list", org_id: orgId },
  });

  if (error) throw error;
  return data.data || [];
}

export async function getLabelTag(tagId: string): Promise<LabelTag> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("label-tags", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "get", id: tagId },
  });

  if (error) throw error;
  return data.data;
}

export async function createLabelTag(orgId: string, name: string, color: string, description?: string): Promise<LabelTag> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("label-tags", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "create", org_id: orgId, name, color, description },
  });

  if (error) throw error;
  return data.data;
}

export async function updateLabelTag(tagId: string, name: string, color: string, description?: string): Promise<LabelTag> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("label-tags", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "update", id: tagId, name, color, description },
  });

  if (error) throw error;
  return data.data;
}

export async function deleteLabelTag(tagId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { error } = await supabase.functions.invoke("label-tags", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "delete", id: tagId },
  });

  if (error) throw error;
}

export async function checkLabelTagUsage(tagId: string): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("label-tags", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "check_usage", id: tagId },
  });

  if (error) throw error;
  return data.count || 0;
}

export type EventSeverity = "critical" | "warning" | "info";

export interface AnomalyEvent {
  id: string;
  org_id: string;
  job_id: string | null;
  signal_ids: string[];
  event_type: string;
  severity: EventSeverity;
  event_data: Record<string, unknown>;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
}

export async function listAnomalyEvents(orgId: string): Promise<AnomalyEvent[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("events", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "list", org_id: orgId },
  });

  if (error) throw error;
  return data.data || [];
}

export async function getAnomalyEvent(eventId: string): Promise<AnomalyEvent> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("events", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: "get", id: eventId },
  });

  if (error) throw error;
  return data.data;
}

export async function acknowledgeEvent(eventId: string): Promise<AnomalyEvent> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await fetch(`/api/events/${eventId}/acknowledge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to acknowledge event");
  }

  return response.json();
}
