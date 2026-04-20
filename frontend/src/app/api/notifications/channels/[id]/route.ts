import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:9999";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const updateChannelSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "Missing Authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return Response.json({ error: "Invalid authentication" }, { status: 401 });
    }

    const { data: userData, error: userDataError } = await supabaseAdmin
      .from("users")
      .select("id, org_id, role")
      .eq("id", user.id)
      .single();

    if (userDataError || !userData) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const orgId = userData.org_id;
    if (!orgId) {
      return Response.json({ error: "User not associated with an organization" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateChannelSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "Invalid request body", details: parsed.error.errors }, { status: 400 });
    }

    const { data: channel, error: channelError } = await supabaseAdmin
      .from("notification_channels")
      .update(parsed.data)
      .eq("id", id)
      .eq("org_id", orgId)
      .select("*")
      .single();

    if (channelError) {
      console.error("Error updating notification channel:", channelError);
      return Response.json({ error: "Failed to update notification channel" }, { status: 500 });
    }

    if (!channel) {
      return Response.json({ error: "Channel not found" }, { status: 404 });
    }

    return Response.json({ data: channel });
  } catch (error) {
    console.error("Update notification channel error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "Missing Authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return Response.json({ error: "Invalid authentication" }, { status: 401 });
    }

    const { data: userData, error: userDataError } = await supabaseAdmin
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (userDataError || !userData) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const orgId = userData.org_id;
    if (!orgId) {
      return Response.json({ error: "User not associated with an organization" }, { status: 400 });
    }

    const { data: channel, error: fetchError } = await supabaseAdmin
      .from("notification_channels")
      .select("id, org_id")
      .eq("id", id)
      .single();

    if (fetchError || !channel) {
      return Response.json({ error: "Channel not found" }, { status: 404 });
    }

    if (channel.org_id !== orgId) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("notification_channels")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting notification channel:", deleteError);
      return Response.json({ error: "Failed to delete notification channel" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Notification channel deletion error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}