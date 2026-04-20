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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const MODEL_INFERENCE_API_URL = process.env.MODEL_INFERENCE_API_URL || "http://localhost:8002";

const ANOMALY_THRESHOLD = 0.7;

const ServeRequestSchema = z.object({
  job_id: z.string().uuid("Invalid job_id format"),
  signal_ids: z.array(z.string().uuid()).min(1, "At least one signal_id is required"),
  context_length: z.number().int().positive().optional().default(512),
  forecast_length: z.number().int().positive().optional().default(128),
});

type ServeRequestInput = z.infer<typeof ServeRequestSchema>;

function isValidUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function getModelPath(orgId: string, jobId: string, modelName: string): string {
  return `${SUPABASE_URL}/storage/v1/object/models/${orgId}/${jobId}/${modelName}`;
}

async function fetchSignalData(orgId: string, signalIds: string[], contextLength: number): Promise<number[]> {
  const { data, error } = await supabaseAdmin
    .from("signal_data")
    .select("value, timestamp")
    .in("signal_id", signalIds)
    .order("timestamp", { ascending: false })
    .limit(contextLength);

  if (error) {
    throw new Error(`Failed to fetch signal data: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error("No signal data available");
  }

  return data.map(d => d.value).reverse();
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body: ServeRequestInput = await request.json();

    const validationResult = ServeRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return Response.json(
        { error: "Validation failed", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { job_id, signal_ids, context_length, forecast_length } = validationResult.data;

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

    const { data: job, error: jobError } = await supabaseAdmin
      .from("training_jobs")
      .select("id, org_id, model_type, status")
      .eq("id", job_id)
      .eq("org_id", orgId)
      .single();

    if (jobError || !job) {
      return Response.json({ error: "Training job not found" }, { status: 404 });
    }

    if (job.status !== "completed") {
      return Response.json(
        { error: `Training job is not completed. Current status: ${job.status}` },
        { status: 400 }
      );
    }

    const signalData = await fetchSignalData(orgId, signal_ids, context_length);

    const modelName = job.model_type === "anomaly_detection" ? "anomaly_model.pkl" : "timesfm_model.pkl";
    const modelPath = getModelPath(orgId, job_id, modelName);

    let predictions: number[];
    let anomalyScores: number[] | undefined;

    try {
      const inferenceEndpoint = job.model_type === "anomaly_detection"
        ? `${MODEL_INFERENCE_API_URL}/infer/anomaly`
        : `${MODEL_INFERENCE_API_URL}/infer/timesfm`;

      const inferenceResponse = await fetch(inferenceEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id,
          model_path: modelPath,
          model_type: job.model_type,
          signal_data: signalData,
          context_length: context_length,
          forecast_length: forecast_length,
        }),
      });

      if (!inferenceResponse.ok) {
        const errorText = await inferenceResponse.text();
        console.error("Inference API error:", inferenceResponse.status, errorText);
        return Response.json(
          { error: `Inference failed: ${inferenceResponse.status} ${errorText}` },
          { status: 500 }
        );
      }

      const inferenceResult = await inferenceResponse.json();
      predictions = inferenceResult.predictions;
      anomalyScores = inferenceResult.anomaly_scores;

      if (anomalyScores && anomalyScores.length > 0 && job.model_type === "anomaly_detection") {
        const highAnomalyScores = anomalyScores.filter((score: number) => score >= ANOMALY_THRESHOLD);
        if (highAnomalyScores.length > 0) {
          await supabaseAdmin.rpc("record_anomaly_event", {
            p_org_id: orgId,
            p_job_id: job_id,
            p_signal_ids: signal_ids,
            p_severity: "warning",
            p_anomaly_scores: JSON.stringify(anomalyScores),
            p_threshold: ANOMALY_THRESHOLD,
          });
        }
      }
    } catch (fetchError) {
      console.error("Inference fetch error:", fetchError);
      return Response.json(
        { error: "Failed to connect to inference service" },
        { status: 500 }
      );
    }

    return Response.json({
      job_id,
      model_type: job.model_type,
      predictions,
      anomaly_scores: anomalyScores,
      context_used: signalData.length,
      forecast_length,
    });
  } catch (error) {
    console.error("Model serve error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}