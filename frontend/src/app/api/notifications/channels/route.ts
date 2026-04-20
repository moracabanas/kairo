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

const channelSchema = z.object({
  channel_type: z.enum(["email", "webhook", "telegram", "mqtt", "mcp"]),
  name: z.string().min(1).max(255),
  config: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

export async function GET(request: Request): Promise<Response> {
  try {
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

    const { data: channels, error: channelsError } = await supabaseAdmin
      .from("notification_channels")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (channelsError) {
      console.error("Error fetching notification channels:", channelsError);
      return Response.json({ error: "Failed to fetch notification channels" }, { status: 500 });
    }

    return Response.json({ data: channels || [] });
  } catch (error) {
    console.error("Get notification channels error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
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
    const parsed = channelSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "Invalid request body", details: parsed.error.errors }, { status: 400 });
    }

    const { data: channel, error: channelError } = await supabaseAdmin
      .from("notification_channels")
      .insert({
        org_id: orgId,
        channel_type: parsed.data.channel_type,
        name: parsed.data.name,
        config: parsed.data.config,
        enabled: parsed.data.enabled,
      })
      .select("*")
      .single();

    if (channelError) {
      console.error("Error creating notification channel:", channelError);
      return Response.json({ error: "Failed to create notification channel" }, { status: 500 });
    }

    return Response.json({ data: channel }, { status: 201 });
  } catch (error) {
    console.error("Create notification channel error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}