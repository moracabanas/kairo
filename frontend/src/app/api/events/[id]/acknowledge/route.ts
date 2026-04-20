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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id: eventId } = await params;

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

    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, org_id, acknowledged")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.org_id !== orgId) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    if (event.acknowledged) {
      return Response.json({ error: "Event already acknowledged" }, { status: 400 });
    }

    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from("events")
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user.id,
      })
      .eq("id", eventId)
      .eq("org_id", orgId)
      .select("id, acknowledged, acknowledged_at, acknowledged_by")
      .single();

    if (updateError) {
      console.error("Error acknowledging event:", updateError);
      return Response.json({ error: "Failed to acknowledge event" }, { status: 500 });
    }

    return Response.json({
      id: updatedEvent.id,
      acknowledged: updatedEvent.acknowledged,
      acknowledged_at: updatedEvent.acknowledged_at,
      acknowledged_by: updatedEvent.acknowledged_by,
    });
  } catch (error) {
    console.error("Acknowledge event error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}