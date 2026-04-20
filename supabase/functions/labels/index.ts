import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Label {
  id: string;
  signal_id: string;
  start_time: string;
  end_time: string;
  label_type: string;
  tag_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface LabelInput {
  signal_id: string;
  start_time: string;
  end_time: string;
  label_type: string;
  tag_id?: string;
  notes?: string;
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

async function checkCanManageLabels(supabase: ReturnType<typeof createClient>, userId: string, orgId: string): Promise<boolean> {
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

async function getSignalOrgId(supabase: ReturnType<typeof createClient>, signalId: string): Promise<string | null> {
  const { data } = await supabase
    .from("signals")
    .select("org_id")
    .eq("id", signalId)
    .single();
  return data?.org_id || null;
}

async function listLabels(
  supabase: ReturnType<typeof createClient>,
  signalId: string,
  userId: string
) {
  const signalOrgId = await getSignalOrgId(supabase, signalId);
  if (!signalOrgId) {
    return new Response(JSON.stringify({ error: "Signal not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== signalOrgId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const canManage = await checkCanManageLabels(supabase, userId, signalOrgId);
  if (!canManage) {
    return new Response(JSON.stringify({ error: "Insufficient permissions to list labels" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("labels")
    .select("id, signal_id, start_time, end_time, label_type, tag_id, notes, created_by, created_at, updated_at")
    .eq("signal_id", signalId)
    .order("start_time", { ascending: false });

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

async function getLabel(
  supabase: ReturnType<typeof createClient>,
  labelId: string,
  userId: string
) {
  const { data: label, error: labelError } = await supabase
    .from("labels")
    .select("id, signal_id, start_time, end_time, label_type, tag_id, notes, created_by, created_at, updated_at")
    .eq("id", labelId)
    .single();

  if (labelError || !label) {
    return new Response(JSON.stringify({ error: "Label not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const signalOrgId = await getSignalOrgId(supabase, label.signal_id);
  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== signalOrgId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data: label }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function createLabel(
  supabase: ReturnType<typeof createClient>,
  input: LabelInput,
  userId: string
) {
  const signalOrgId = await getSignalOrgId(supabase, input.signal_id);
  if (!signalOrgId) {
    return new Response(JSON.stringify({ error: "Signal not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== signalOrgId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const canManage = await checkCanManageLabels(supabase, userId, signalOrgId);
  if (!canManage) {
    return new Response(JSON.stringify({ error: "Insufficient permissions to create labels" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const validLabelTypes = ["normal", "anomaly", "custom"];
  if (!validLabelTypes.includes(input.label_type)) {
    return new Response(JSON.stringify({ error: "Invalid label_type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("labels")
    .insert({
      signal_id: input.signal_id,
      start_time: input.start_time,
      end_time: input.end_time,
      label_type: input.label_type,
      tag_id: input.tag_id || null,
      notes: input.notes || null,
      created_by: userId,
    })
    .select("id, signal_id, start_time, end_time, label_type, tag_id, notes, created_by, created_at, updated_at")
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

async function updateLabel(
  supabase: ReturnType<typeof createClient>,
  labelId: string,
  input: Partial<LabelInput>,
  userId: string
) {
  const { data: existingLabel, error: labelError } = await supabase
    .from("labels")
    .select("id, signal_id")
    .eq("id", labelId)
    .single();

  if (labelError || !existingLabel) {
    return new Response(JSON.stringify({ error: "Label not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const signalOrgId = await getSignalOrgId(supabase, existingLabel.signal_id);
  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== signalOrgId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const canManage = await checkCanManageLabels(supabase, userId, signalOrgId!);
  if (!canManage) {
    return new Response(JSON.stringify({ error: "Insufficient permissions to update labels" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (input.label_type && !["normal", "anomaly", "custom"].includes(input.label_type)) {
    return new Response(JSON.stringify({ error: "Invalid label_type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const updates: Partial<LabelInput> = {};
  if (input.start_time !== undefined) updates.start_time = input.start_time;
  if (input.end_time !== undefined) updates.end_time = input.end_time;
  if (input.label_type !== undefined) updates.label_type = input.label_type;
  if (input.tag_id !== undefined) updates.tag_id = input.tag_id;
  if (input.notes !== undefined) updates.notes = input.notes;

  const { data, error } = await supabase
    .from("labels")
    .update(updates)
    .eq("id", labelId)
    .select("id, signal_id, start_time, end_time, label_type, tag_id, notes, created_by, created_at, updated_at")
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

async function deleteLabel(
  supabase: ReturnType<typeof createClient>,
  labelId: string,
  userId: string
) {
  const { data: existingLabel, error: labelError } = await supabase
    .from("labels")
    .select("id, signal_id")
    .eq("id", labelId)
    .single();

  if (labelError || !existingLabel) {
    return new Response(JSON.stringify({ error: "Label not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const signalOrgId = await getSignalOrgId(supabase, existingLabel.signal_id);
  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== signalOrgId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isOwner = await checkIsOwner(supabase, userId, signalOrgId!);
  if (!isOwner) {
    return new Response(JSON.stringify({ error: "Only owners can delete labels" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: deleteError } = await supabase
    .from("labels")
    .delete()
    .eq("id", labelId);

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
    const labelId = url.searchParams.get("id");

    if (!action) {
      return new Response(JSON.stringify({ error: "action query parameter required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const signalId = url.searchParams.get("signal_id");
      if (!signalId) {
        return new Response(JSON.stringify({ error: "signal_id query parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return listLabels(supabase, signalId, user.id);
    }

    if (action === "get") {
      if (!labelId) {
        return new Response(JSON.stringify({ error: "id query parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return getLabel(supabase, labelId, user.id);
    }

    if (action === "create") {
      const body = await req.json();
      return createLabel(supabase, body, user.id);
    }

    if (action === "update") {
      if (!labelId) {
        return new Response(JSON.stringify({ error: "id query parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await req.json();
      return updateLabel(supabase, labelId, body, user.id);
    }

    if (action === "delete") {
      if (!labelId) {
        return new Response(JSON.stringify({ error: "id query parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return deleteLabel(supabase, labelId, user.id);
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
