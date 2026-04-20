import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Organization {
  id: string;
  name: string;
  plan: string;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

interface OrgUsage {
  user_count: number;
  signal_count: number;
  storage_estimate_mb: number;
}

interface OrgAdmin {
  id: string;
  email: string;
  role: string;
}

function getDbConnection() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("POSTGRES_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, supabaseServiceKey || "", {
    auth: { persistSession: false },
  });
}

async function getOrganization(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  requestingUserId: string
) {
  const { data: requestingUser } = await supabase
    .from("users")
    .select("role, org_id")
    .eq("id", requestingUserId)
    .single();

  if (!requestingUser || requestingUser.org_id !== orgId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, plan, stripe_customer_id, created_at, updated_at")
    .eq("id", orgId)
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!data) {
    return new Response(JSON.stringify({ error: "Organization not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function updateOrganization(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  name: string,
  requestingUserId: string
) {
  const { data: requestingUser } = await supabase
    .from("users")
    .select("role, org_id")
    .eq("id", requestingUserId)
    .single();

  if (!requestingUser || requestingUser.org_id !== orgId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!["owner", "admin"].includes(requestingUser.role)) {
    return new Response(JSON.stringify({ error: "Only owners and admins can update organization" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("organizations")
    .update({ name })
    .eq("id", orgId)
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

async function getOrganizationUsage(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  requestingUserId: string
) {
  const { data: requestingUser } = await supabase
    .from("users")
    .select("role, org_id")
    .eq("id", requestingUserId)
    .single();

  if (!requestingUser || requestingUser.org_id !== orgId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { count: userCount } = await supabase
    .from("users")
    .select("id", { count: "exact" })
    .eq("org_id", orgId);

  const { count: signalCount } = await supabase
    .from("signals")
    .select("id", { count: "exact" })
    .eq("org_id", orgId);

  const usage: OrgUsage = {
    user_count: userCount || 0,
    signal_count: signalCount || 0,
    storage_estimate_mb: 0,
  };

  return new Response(JSON.stringify({ data: usage }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function listAdmins(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  requestingUserId: string
) {
  const { data: requestingUser } = await supabase
    .from("users")
    .select("role, org_id")
    .eq("id", requestingUserId)
    .single();

  if (!requestingUser || requestingUser.org_id !== orgId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("org_id", orgId)
    .in("role", ["owner", "admin"]);

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

async function transferOwnership(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  newOwnerUserId: string,
  requestingUserId: string
) {
  const { data: requestingUser } = await supabase
    .from("users")
    .select("role, org_id")
    .eq("id", requestingUserId)
    .single();

  if (!requestingUser || requestingUser.org_id !== orgId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (requestingUser.role !== "owner") {
    return new Response(JSON.stringify({ error: "Only owners can transfer ownership" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: newOwner } = await supabase
    .from("users")
    .select("id, role, org_id")
    .eq("id", newOwnerUserId)
    .single();

  if (!newOwner) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (newOwner.org_id !== orgId) {
    return new Response(JSON.stringify({ error: "User not in your organization" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (newOwner.role !== "admin") {
    return new Response(JSON.stringify({ error: "New owner must be an admin" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase
    .from("users")
    .update({ role: "admin" })
    .eq("id", requestingUserId);

  const { data, error } = await supabase
    .from("users")
    .update({ role: "owner" })
    .eq("id", newOwnerUserId)
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
    const functionIndex = pathParts.indexOf("orgs");
    const action = pathParts[functionIndex + 1];

    const { searchParams } = url;
    const orgId = searchParams.get("org_id");

    if (action === "get" && req.method === "GET") {
      if (!orgId) {
        return new Response(JSON.stringify({ error: "org_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return getOrganization(supabase, orgId, user.id);
    }

    if (action === "update" && req.method === "PATCH") {
      if (!orgId) {
        return new Response(JSON.stringify({ error: "org_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await req.json();
      return updateOrganization(supabase, orgId, body.name, user.id);
    }

    if (action === "usage" && req.method === "GET") {
      if (!orgId) {
        return new Response(JSON.stringify({ error: "org_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return getOrganizationUsage(supabase, orgId, user.id);
    }

    if (action === "admins" && req.method === "GET") {
      if (!orgId) {
        return new Response(JSON.stringify({ error: "org_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return listAdmins(supabase, orgId, user.id);
    }

    if (action === "transfer" && req.method === "POST") {
      if (!orgId) {
        return new Response(JSON.stringify({ error: "org_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await req.json();
      return transferOwnership(supabase, orgId, body.new_owner_user_id, user.id);
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