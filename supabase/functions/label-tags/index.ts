import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LabelTag {
  id: string;
  org_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
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

async function listTags(
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

  const { data, error } = await supabase
    .from("label_tags")
    .select("*")
    .eq("org_id", orgId)
    .order("name");

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

async function getTag(
  supabase: ReturnType<typeof createClient>,
  tagId: string,
  userId: string
) {
  const { data: tag, error: tagError } = await supabase
    .from("label_tags")
    .select("*")
    .eq("id", tagId)
    .single();

  if (tagError || !tag) {
    return new Response(JSON.stringify({ error: "Tag not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== tag.org_id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data: tag }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function createTag(
  supabase: ReturnType<typeof createClient>,
  input: { org_id: string; name: string; color?: string; description?: string },
  userId: string
) {
  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== input.org_id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("label_tags")
    .insert({
      org_id: input.org_id,
      name: input.name,
      color: input.color || "#6b7280",
      description: input.description || null,
    })
    .select("*")
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

async function updateTag(
  supabase: ReturnType<typeof createClient>,
  tagId: string,
  input: { name?: string; color?: string; description?: string },
  userId: string
) {
  const { data: existingTag, error: tagError } = await supabase
    .from("label_tags")
    .select("org_id")
    .eq("id", tagId)
    .single();

  if (tagError || !existingTag) {
    return new Response(JSON.stringify({ error: "Tag not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== existingTag.org_id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const updates: Partial<LabelTag> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.color !== undefined) updates.color = input.color;
  if (input.description !== undefined) updates.description = input.description;

  const { data, error } = await supabase
    .from("label_tags")
    .update(updates)
    .eq("id", tagId)
    .select("*")
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

async function deleteTag(
  supabase: ReturnType<typeof createClient>,
  tagId: string,
  userId: string
) {
  const { data: existingTag, error: tagError } = await supabase
    .from("label_tags")
    .select("org_id")
    .eq("id", tagId)
    .single();

  if (tagError || !existingTag) {
    return new Response(JSON.stringify({ error: "Tag not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== existingTag.org_id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { count, error: countError } = await supabase
    .from("labels")
    .select("id", { count: "exact" })
    .eq("tag_id", tagId);

  if (!countError && count && count > 0) {
    return new Response(JSON.stringify({ error: `Cannot delete tag with ${count} existing label(s). Please remove or reassign labels first.` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: deleteError } = await supabase
    .from("label_tags")
    .delete()
    .eq("id", tagId);

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

async function checkTagUsage(
  supabase: ReturnType<typeof createClient>,
  tagId: string,
  userId: string
) {
  const { data: existingTag, error: tagError } = await supabase
    .from("label_tags")
    .select("org_id")
    .eq("id", tagId)
    .single();

  if (tagError || !existingTag) {
    return new Response(JSON.stringify({ error: "Tag not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userOrgId = await getUserOrgId(supabase, userId);
  if (userOrgId !== existingTag.org_id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { count, error } = await supabase
    .from("labels")
    .select("id", { count: "exact" })
    .eq("tag_id", tagId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ count }), {
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
    const tagId = url.searchParams.get("id");
    const orgId = url.searchParams.get("org_id");

    if (!action) {
      return new Response(JSON.stringify({ error: "action query parameter required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      if (!orgId) {
        return new Response(JSON.stringify({ error: "org_id query parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return listTags(supabase, orgId, user.id);
    }

    if (action === "get") {
      if (!tagId) {
        return new Response(JSON.stringify({ error: "id query parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return getTag(supabase, tagId, user.id);
    }

    if (action === "create") {
      const body = await req.json();
      return createTag(supabase, body, user.id);
    }

    if (action === "update") {
      if (!tagId) {
        return new Response(JSON.stringify({ error: "id query parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await req.json();
      return updateTag(supabase, tagId, body, user.id);
    }

    if (action === "delete") {
      if (!tagId) {
        return new Response(JSON.stringify({ error: "id query parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return deleteTag(supabase, tagId, user.id);
    }

    if (action === "check_usage") {
      if (!tagId) {
        return new Response(JSON.stringify({ error: "id query parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return checkTagUsage(supabase, tagId, user.id);
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
