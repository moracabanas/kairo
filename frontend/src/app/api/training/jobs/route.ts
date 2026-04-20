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

const HyperparametersSchema = z.object({
  learning_rate: z.number().positive().optional(),
  epochs: z.number().int().positive().optional(),
  batch_size: z.number().int().positive().optional(),
  context_length: z.number().int().positive().optional(),
  forecast_length: z.number().int().positive().optional(),
});

const CreateTrainingJobSchema = z.object({
  signal_ids: z.array(z.string().uuid()).min(1, "At least one signal_id is required"),
  model_type: z.enum(["anomaly_detection", "timesfm_finetune"]),
  hyperparameters: HyperparametersSchema.optional().default({}),
  schedule_type: z.enum(["now", "scheduled"]),
  scheduled_time: z.string().refine((val) => !val || !isNaN(Date.parse(val)), "Invalid datetime format").nullable().optional(),
});

type CreateTrainingJobInput = z.infer<typeof CreateTrainingJobSchema>;

function isValidUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body: CreateTrainingJobInput = await request.json();

    const validationResult = CreateTrainingJobSchema.safeParse(body);
    if (!validationResult.success) {
      return Response.json(
        { error: "Validation failed", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { signal_ids, model_type, hyperparameters, schedule_type, scheduled_time } = validationResult.data;

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "Missing Authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return Response.json({ error: "Invalid authentication" }, { status: 401 });
    }

    const userId = user.id;

    const { data: userData, error: userDataError } = await supabaseAdmin
      .from("users")
      .select("id, org_id, role")
      .eq("id", userId)
      .single();

    if (userDataError || !userData) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const orgId = userData.org_id;

    if (!orgId) {
      return Response.json({ error: "User not associated with an organization" }, { status: 400 });
    }

    for (const signalId of signal_ids) {
      if (!isValidUuid(signalId)) {
        return Response.json({ error: `Invalid signal_id format: ${signalId}` }, { status: 400 });
      }
    }

    const { data: signals, error: signalsError } = await supabaseAdmin
      .from("signals")
      .select("id, org_id")
      .in("id", signal_ids);

    if (signalsError) {
      console.error("Error fetching signals:", signalsError);
      return Response.json({ error: "Failed to validate signals" }, { status: 500 });
    }

    if (!signals || signals.length !== signal_ids.length) {
      return Response.json({ error: "One or more signals not found" }, { status: 404 });
    }

    const invalidSignals = signals.filter(s => s.org_id !== orgId);
    if (invalidSignals.length > 0) {
      return Response.json({ error: "Access denied to one or more signals" }, { status: 403 });
    }

    if (schedule_type === "scheduled" && !scheduled_time) {
      return Response.json({ error: "scheduled_time is required when schedule_type is 'scheduled'" }, { status: 400 });
    }

    if (schedule_type === "scheduled" && scheduled_time) {
      const scheduledDate = new Date(scheduled_time);
      if (scheduledDate <= new Date()) {
        return Response.json({ error: "scheduled_time must be in the future" }, { status: 400 });
      }
    }

    const status = schedule_type === "now" ? "queued" : "scheduled";

    const { data: job, error: insertError } = await supabaseAdmin
      .from("training_jobs")
      .insert({
        org_id: orgId,
        user_id: userId,
        signal_ids,
        model_type,
        hyperparameters: hyperparameters || {},
        schedule_type,
        scheduled_time: schedule_type === "scheduled" ? scheduled_time : null,
        status,
      })
      .select("id, status")
      .single();

    if (insertError) {
      console.error("Error creating training job:", insertError);
      return Response.json({ error: "Failed to create training job" }, { status: 500 });
    }

    if (schedule_type === "now") {
      try {
        const clearmlTaskId = await submitTrainingJobToClearML({
          orgId,
          userId,
          signalIds: signal_ids,
          modelType: model_type,
          hyperparameters: hyperparameters || {},
        });

        await supabaseAdmin
          .from("training_jobs")
          .update({ clearml_task_id: clearmlTaskId })
          .eq("id", job.id);

        return Response.json({
          job_id: job.id,
          clearml_task_id: clearmlTaskId,
          status: "queued",
          message: "Training job submitted to queue",
        }, { status: 201 });
      } catch (clearmlError) {
        console.error("ClearML submission error:", clearmlError);
        await supabaseAdmin
          .from("training_jobs")
          .update({
            status: "failed",
            error_message: clearmlError instanceof Error ? clearmlError.message : "ClearML submission failed",
          })
          .eq("id", job.id);

        return Response.json({
          job_id: job.id,
          status: "failed",
          error: "Training job created but ClearML submission failed",
        }, { status: 500 });
      }
    }

    return Response.json({
      job_id: job.id,
      status: "scheduled",
      message: "Training job scheduled for future execution",
    }, { status: 201 });
  } catch (error) {
    console.error("Training job error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

async function submitTrainingJobToClearML(params: {
  orgId: string;
  userId: string;
  signalIds: string[];
  modelType: string;
  hyperparameters: Record<string, number>;
}): Promise<string> {
  const CLEARML_API_HOST = process.env.CLEARML_API_HOST || "http://localhost:8080";
  const CLEARML_API_ACCESS_KEY = process.env.CLEARML_API_ACCESS_KEY || "";
  const CLEARML_API_SECRET_KEY = process.env.CLEARML_API_SECRET_KEY || "";
  const CLEARML_DEFAULT_QUEUE = process.env.CLEARML_TRAINING_QUEUE || "training";

  const authHeader = `Basic ${Buffer.from(`${CLEARML_API_ACCESS_KEY}:${CLEARML_API_SECRET_KEY}`).toString("base64")}`;

  const response = await fetch(`${CLEARML_API_HOST}/api/v2/queues`, {
    headers: { Authorization: authHeader },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ClearML queues: ${response.status}`);
  }

  const queuesData = await response.json();
  const queue = queuesData.data?.find((q: { name: string }) => q.name === CLEARML_DEFAULT_QUEUE);

  if (!queue) {
    throw new Error(`Queue '${CLEARML_DEFAULT_QUEUE}' not found in ClearML`);
  }

  const queueId = queue.id;
  const taskName = `kairo-training-${Date.now().toString(36)}`;

  const createResponse = await fetch(`${CLEARML_API_HOST}/api/v2/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      name: taskName,
      project: "Kairo",
      type: "training",
      script: {
        interpreter: "python3",
        args: `--job-id ${params.orgId} --org-id ${params.orgId} --user-id ${params.userId} --signal-ids ${JSON.stringify(params.signalIds)} --model-type ${params.modelType} --learning-rate ${params.hyperparameters.learning_rate} --epochs ${params.hyperparameters.epochs} --batch-size ${params.hyperparameters.batch_size} --context-length ${params.hyperparameters.context_length} --forecast-length ${params.hyperparameters.forecast_length}`,
      },
      container: {
        image: "python:3.10-slim",
      },
      hyperparameters: {
        args: {
          "--model-type": params.modelType,
          "--learning-rate": params.hyperparameters.learning_rate,
          "--epochs": params.hyperparameters.epochs,
          "--batch-size": params.hyperparameters.batch_size,
          "--context-length": params.hyperparameters.context_length,
          "--forecast-length": params.hyperparameters.forecast_length,
        },
      },
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create ClearML task: ${createResponse.status} ${errorText}`);
  }

  const createData = await createResponse.json();
  const taskId = createData.id;

  const enqueueResponse = await fetch(`${CLEARML_API_HOST}/api/v2/tasks.enqueue`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      task_id: taskId,
      queue_id: queueId,
    }),
  });

  if (!enqueueResponse.ok) {
    const errorText = await enqueueResponse.text();
    throw new Error(`Failed to enqueue task: ${enqueueResponse.status} ${errorText}`);
  }

  return taskId;
}

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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    let query = supabaseAdmin
      .from("training_jobs")
      .select("id, status, model_type, schedule_type, scheduled_time, clearml_task_id, created_at, completed_at, error_message")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: jobs, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching training jobs:", fetchError);
      return Response.json({ error: "Failed to fetch training jobs" }, { status: 500 });
    }

    return Response.json({ jobs: jobs || [] });
  } catch (error) {
    console.error("Training jobs fetch error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}