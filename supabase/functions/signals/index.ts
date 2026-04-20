import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Signal {
  id: string;
  org_id: string;
  name: string;
  source_type: string;
  source_config: Record<string, unknown>;
  schema: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface SignalInput {
  name: string;
  source_type: string;
  source_config?: Record<string, unknown>;
  schema?: Record<string, unknown>;
}

function getServiceRoleClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("POSTGRES_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, supabaseServiceKey || "", {
    auth: { persistSession: false },
  });
}

async function getUserOrgId(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", userId)
    .single();
  return data?.org_id || null;
}

async function checkCanManageSignals(supabase: ReturnType<typeof createClient>, userId: string, orgId: string): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .eq("org_id", orgId)
    .single();

  if (!data) return false;
  const role = data.role;
  return ["owner", "admin", "analyst"].includes(role);
}

async function checkIsOwner(supabase: ReturnType<typeof createClient>, userId: string, orgId: string): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .eq("org_id", orgId)
    .single();

  return data?.role === "owner";
}

async function listSignals(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string
) {
  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== orgId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const canManage = await checkCanManageSignals(supabase, userId, orgId);
  if (!canManage) {
    return new Response(JSON.stringify({ error: "Insufficient permissions to list signals" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("signals")
    .select("id, org_id, name, source_type, schema, created_at, updated_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

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

async function getSignal(
  supabase: ReturnType<typeof createClient>,
  signalId: string,
  userId: string
) {
  const { data: signal, error: signalError } = await supabase
    .from("signals")
    .select("id, org_id, name, source_type, source_config, schema, created_at, updated_at")
    .eq("id", signalId)
    .single();

  if (signalError || !signal) {
    return new Response(JSON.stringify({ error: "Signal not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== signal.org_id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const canManage = await checkCanManageSignals(supabase, userId, signal.org_id);
  if (!canManage) {
    return new Response(JSON.stringify({ error: "Insufficient permissions to view signal" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data: signal }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function createSignal(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  input: SignalInput,
  userId: string
) {
  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== orgId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const canManage = await checkCanManageSignals(supabase, userId, orgId);
  if (!canManage) {
    return new Response(JSON.stringify({ error: "Insufficient permissions to create signals" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const validSourceTypes = ["database", "mqtt", "file", "log"];
  if (!validSourceTypes.includes(input.source_type)) {
    return new Response(JSON.stringify({ error: "Invalid source_type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("signals")
    .insert({
      org_id: orgId,
      name: input.name,
      source_type: input.source_type,
      source_config: input.source_config || {},
      schema: input.schema || {},
    })
    .select("id, org_id, name, source_type, schema, created_at, updated_at")
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

async function updateSignal(
  supabase: ReturnType<typeof createClient>,
  signalId: string,
  input: Partial<SignalInput>,
  userId: string
) {
  const { data: existingSignal, error: signalError } = await supabase
    .from("signals")
    .select("id, org_id")
    .eq("id", signalId)
    .single();

  if (signalError || !existingSignal) {
    return new Response(JSON.stringify({ error: "Signal not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== existingSignal.org_id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const canManage = await checkCanManageSignals(supabase, userId, existingSignal.org_id);
  if (!canManage) {
    return new Response(JSON.stringify({ error: "Insufficient permissions to update signals" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (input.source_type && !["database", "mqtt", "file", "log"].includes(input.source_type)) {
    return new Response(JSON.stringify({ error: "Invalid source_type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const updates: Partial<SignalInput> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.source_type !== undefined) updates.source_type = input.source_type;
  if (input.source_config !== undefined) updates.source_config = input.source_config;
  if (input.schema !== undefined) updates.schema = input.schema;

  const { data, error } = await supabase
    .from("signals")
    .update(updates)
    .eq("id", signalId)
    .select("id, org_id, name, source_type, schema, created_at, updated_at")
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

async function deleteSignal(
  supabase: ReturnType<typeof createClient>,
  signalId: string,
  userId: string
) {
  const { data: existingSignal, error: signalError } = await supabase
    .from("signals")
    .select("id, org_id")
    .eq("id", signalId)
    .single();

  if (signalError || !existingSignal) {
    return new Response(JSON.stringify({ error: "Signal not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== existingSignal.org_id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isOwner = await checkIsOwner(supabase, userId, existingSignal.org_id);
  if (!isOwner) {
    return new Response(JSON.stringify({ error: "Only owners can delete signals" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: deleteError } = await supabase
    .from("signals")
    .delete()
    .eq("id", signalId);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
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
    const supabase = getServiceRoleClient();
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
    const action = url.searchParams.get("action");
    const signalId = url.searchParams.get("id");

    if (!action) {
      return new Response(JSON.stringify({ error: "action query parameter required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const orgId = url.searchParams.get("org_id");
      if (!orgId) {
        return new Response(JSON.stringify({ error: "org_id query parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return listSignals(supabase, orgId, user.id);
    }

    if (action === "get") {
      if (!signalId) {
        return new Response(JSON.stringify({ error: "id query parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return getSignal(supabase, signalId, user.id);
    }

    if (action === "create") {
      const orgId = url.searchParams.get("org_id");
      if (!orgId) {
        return new Response(JSON.stringify({ error: "org_id query parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await req.json();
      return createSignal(supabase, orgId, body, user.id);
    }

    if (action === "update") {
      if (!signalId) {
        return new Response(JSON.stringify({ error: "id query parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await req.json();
      return updateSignal(supabase, signalId, body, user.id);
    }

    if (action === "delete") {
      if (!signalId) {
        return new Response(JSON.stringify({ error: "id query parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return deleteSignal(supabase, signalId, user.id);
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
