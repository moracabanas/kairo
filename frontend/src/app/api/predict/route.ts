import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:9999";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TIMESFM_API_URL = process.env.TIMESFM_API_URL || "http://localhost:8001";

interface PredictRequestBody {
  signal_id: string;
  context_length?: number;
  forecast_length?: number;
  frequency?: number;
}

interface TimesFMRequest {
  signal_id: string;
  context: number[];
  forecast_length: number;
  context_length: number;
  frequency: number;
}

interface TimesFMResponse {
  signal_id: string;
  forecast: number[];
  lower_bound: number[];
  upper_bound: number[];
  confidence: number;
}

const DEFAULT_CONTEXT_LENGTH = 512;
const DEFAULT_FORECAST_LENGTH = 128;
const DEFAULT_FREQUENCY = 3600;

function isValidUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
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
      .select("id, org_id")
      .eq("id", user.id)
      .single();
    if (userDataError || !userData?.org_id) {
      return Response.json({ error: "User not found or not in organization" }, { status: 404 });
    }
    const userOrgId = userData.org_id;

    const body: PredictRequestBody = await request.json();

    if (!body.signal_id) {
      return Response.json({ error: "signal_id is required" }, { status: 400 });
    }

    if (!isValidUuid(body.signal_id)) {
      return Response.json({ error: "Invalid signal_id format" }, { status: 400 });
    }

    const contextLength = body.context_length ?? DEFAULT_CONTEXT_LENGTH;
    const forecastLength = Math.min(body.forecast_length ?? DEFAULT_FORECAST_LENGTH, 512);
    const frequency = body.frequency ?? DEFAULT_FREQUENCY;

    if (contextLength <= 0) {
      return Response.json({ error: "context_length must be positive" }, { status: 400 });
    }

    if (forecastLength <= 0) {
      return Response.json({ error: "forecast_length must be positive" }, { status: 400 });
    }

    if (frequency <= 0) {
      return Response.json({ error: "frequency must be positive" }, { status: 400 });
    }

    const signal = await supabaseAdmin
      .from("signals")
      .select("id, org_id")
      .eq("id", body.signal_id)
      .eq("org_id", userOrgId)
      .single();

    if (signal.error || !signal.data) {
      return Response.json({ error: "Signal not found or access denied" }, { status: 404 });
    }

    const signalOrgId = signal.data.org_id;

    const { data: signalData, error: signalDataError } = await supabaseAdmin
      .from("signal_data")
      .select("value")
      .eq("signal_id", body.signal_id)
      .order("timestamp", { ascending: false })
      .limit(contextLength);

    if (signalDataError) {
      console.error("Error fetching signal data:", signalDataError);
      return Response.json({ error: "Failed to fetch signal data" }, { status: 500 });
    }

    if (!signalData || signalData.length === 0) {
      return Response.json({ error: "No signal data available" }, { status: 400 });
    }

    const context = signalData.map(d => d.value).reverse();

    const timesfmRequest: TimesFMRequest = {
      signal_id: body.signal_id,
      context,
      forecast_length: forecastLength,
      context_length: contextLength,
      frequency,
    };

    let timesfmResponse: TimesFMResponse;
    try {
      const timesfmRes = await fetch(`${TIMESFM_API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(timesfmRequest),
      });

      if (!timesfmRes.ok) {
        const errorText = await timesfmRes.text();
        console.error("TimesFM API error:", timesfmRes.status, errorText);
        return Response.json(
          { error: `TimesFM API call failed: ${timesfmRes.status} ${errorText}` },
          { status: 500 }
        );
      }

      timesfmResponse = await timesfmRes.json();
    } catch (fetchError) {
      console.error("TimesFM fetch error:", fetchError);
      return Response.json(
        { error: "Failed to connect to TimesFM API" },
        { status: 500 }
      );
    }

    const predictionRecord = {
      signal_id: body.signal_id,
      org_id: signalOrgId,
      forecast: timesfmResponse.forecast,
      lower_bound: timesfmResponse.lower_bound,
      upper_bound: timesfmResponse.upper_bound,
      confidence: timesfmResponse.confidence,
      forecast_length: forecastLength,
      context_used: contextLength,
      frequency_used: frequency,
    };

    const { error: insertError } = await supabaseAdmin
      .from("signal_predictions")
      .insert(predictionRecord);

    if (insertError) {
      console.error("Error storing prediction:", insertError);
      return Response.json({ error: "Failed to store prediction" }, { status: 500 });
    }

    return Response.json({
      signal_id: timesfmResponse.signal_id,
      forecast: timesfmResponse.forecast,
      lower_bound: timesfmResponse.lower_bound,
      upper_bound: timesfmResponse.upper_bound,
      confidence: timesfmResponse.confidence,
      context_used: context.length,
      forecast_length: forecastLength,
    });
  } catch (error) {
    console.error("Predict error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
