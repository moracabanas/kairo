import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:9999";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function GET(
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

    const { data: job, error: jobError } = await supabaseAdmin
      .from("training_jobs")
      .select("id, org_id, model_type, status, created_at, completed_at, error_message")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (jobError || !job) {
      return Response.json({ error: "Model not found" }, { status: 404 });
    }

    return Response.json({
      job_id: job.id,
      status: job.status,
      model_type: job.model_type,
      created_at: job.created_at,
      completed_at: job.completed_at,
      error_message: job.error_message,
    });
  } catch (error) {
    console.error("Model info error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}