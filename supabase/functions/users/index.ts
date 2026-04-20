import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface User {
  id: string;
  email: string;
  role: string;
  org_id: string;
  created_at: string;
}

function getDbConnection() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("POSTGRES_SERVICE_ROLE_KEY");
  
  return createClient(supabaseUrl, supabaseServiceKey || "", {
    auth: { persistSession: false },
  });
}

async function listOrgUsers(supabase: ReturnType<typeof createClient>, orgId: string, requestingUserId: string) {
  const { data: requestingUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", requestingUserId)
    .single();
  
  if (!requestingUser || !["owner", "admin"].includes(requestingUser.role)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, email, role, org_id, created_at")
    .eq("org_id", orgId)
    .order("created_at");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function inviteUser(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  email: string,
  role: string,
  requestingUserId: string
) {
  const validRoles = ["admin", "analyst", "viewer"];
  if (!validRoles.includes(role)) {
    return new Response(JSON.stringify({ error: "Invalid role" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: requestingUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", requestingUserId)
    .single();

  if (!requestingUser || !["owner", "admin"].includes(requestingUser.role)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existingUser) {
    return new Response(JSON.stringify({ error: "User already exists" }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("users")
    .insert({ org_id: orgId, email, role })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data }), {
    status: 201,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function updateUserRole(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  newRole: string,
  requestingUserId: string
) {
  const validRoles = ["owner", "admin", "analyst", "viewer"];
  if (!validRoles.includes(newRole)) {
    return new Response(JSON.stringify({ error: "Invalid role" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (userId === requestingUserId) {
    return new Response(JSON.stringify({ error: "Cannot change your own role" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: targetUser } = await supabase
    .from("users")
    .select("id, role, org_id")
    .eq("id", userId)
    .single();

  if (!targetUser) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: requestingUser } = await supabase
    .from("users")
    .select("role, org_id")
    .eq("id", requestingUserId)
    .single();

  if (!requestingUser || !["owner", "admin"].includes(requestingUser.role)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (targetUser.org_id !== requestingUser.org_id) {
    return new Response(JSON.stringify({ error: "User not in your organization" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (targetUser.role === "owner") {
    return new Response(JSON.stringify({ error: "Cannot change owner role" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (newRole === "owner") {
    return new Response(JSON.stringify({ error: "Cannot assign owner role" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminCount = await supabase
    .from("users")
    .select("id", { count: "exact" })
    .eq("org_id", targetUser.org_id)
    .eq("role", "admin");

  if (adminCount.count === 1 && targetUser.role === "admin" && newRole !== "admin") {
    return new Response(JSON.stringify({ error: "Cannot demote the last admin" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("users")
    .update({ role: newRole })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function removeUserFromOrg(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  requestingUserId: string
) {
  if (userId === requestingUserId) {
    return new Response(JSON.stringify({ error: "Cannot remove yourself" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: targetUser } = await supabase
    .from("users")
    .select("id, role, org_id")
    .eq("id", userId)
    .single();

  if (!targetUser) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: requestingUser } = await supabase
    .from("users")
    .select("role, org_id")
    .eq("id", requestingUserId)
    .single();

  if (!requestingUser || !["owner", "admin"].includes(requestingUser.role)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (targetUser.org_id !== requestingUser.org_id) {
    return new Response(JSON.stringify({ error: "User not in your organization" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (targetUser.role === "owner") {
    return new Response(JSON.stringify({ error: "Cannot remove owner" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminCount = await supabase
    .from("users")
    .select("id", { count: "exact" })
    .eq("org_id", targetUser.org_id)
    .eq("role", "admin");

  if (adminCount.count === 1 && targetUser.role === "admin") {
    return new Response(JSON.stringify({ error: "Cannot remove the last admin" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getDbConnection();
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const functionIndex = pathParts.indexOf("users");
    const action = pathParts[functionIndex + 1];

    const { searchParams } = url;
    const orgId = searchParams.get("org_id");

    if (action === "list" && req.method === "GET") {
      if (!orgId) {
        return new Response(JSON.stringify({ error: "org_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return listOrgUsers(supabase, orgId, user.id);
    }

    if (action === "invite" && req.method === "POST") {
      if (!orgId) {
        return new Response(JSON.stringify({ error: "org_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await req.json();
      return inviteUser(supabase, orgId, body.email, body.role, user.id);
    }

    if (action === "update-role" && req.method === "POST") {
      const body = await req.json();
      return updateUserRole(supabase, body.user_id, body.new_role, user.id);
    }

    if (action === "remove" && req.method === "POST") {
      const body = await req.json();
      return removeUserFromOrg(supabase, body.user_id, user.id);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});