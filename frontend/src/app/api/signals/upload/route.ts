import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:9999";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".csv", ".json"];

interface SignalDataPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, unknown>;
}

interface UploadResult {
  success_count: number;
  errors: string[];
}

class CsvParser {
  parse(fileContent: string): SignalDataPoint[] {
    const lines = fileContent.trim().split('\n');
    if (lines.length === 0) {
      return [];
    }

    const result: SignalDataPoint[] = [];
    let startIndex = 0;

    const firstLine = lines[0].trim();
    const hasHeader = isNaN(Date.parse(firstLine.split(',')[0])) &&
                      isNaN(parseFloat(firstLine.split(',')[1]));

    if (hasHeader) {
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 2) continue;

      const timestamp = new Date(parts[0].trim());
      const value = parseFloat(parts[1].trim());

      if (isNaN(timestamp.getTime()) || isNaN(value)) {
        continue;
      }

      let metadata: Record<string, unknown> | undefined;
      if (parts.length > 2) {
        const metadataStr = parts.slice(2).join(',').trim();
        if (metadataStr) {
          try {
            metadata = JSON.parse(metadataStr);
          } catch {
            metadata = { raw: metadataStr };
          }
        }
      }

      result.push({ timestamp, value, metadata });
    }

    return result;
  }
}

class JsonParser {
  parse(fileContent: string): SignalDataPoint[] {
    const parsed = JSON.parse(fileContent);

    if (!Array.isArray(parsed)) {
      throw new Error('JSON must be an array of data points');
    }

    const result: SignalDataPoint[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const timestamp = item.timestamp ? new Date(item.timestamp) : null;
      const value = typeof item.value === 'number' ? item.value : parseFloat(item.value);

      if (!timestamp || isNaN(timestamp.getTime())) {
        continue;
      }
      if (isNaN(value)) {
        continue;
      }

      const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : undefined;

      result.push({
        timestamp,
        value,
        metadata: metadata as Record<string, unknown> | undefined,
      });
    }

    return result;
  }
}

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : '';
}

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const signalId = formData.get("signal_id") as string | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (!signalId) {
      return Response.json({ error: "No signal_id provided" }, { status: 400 });
    }

    if (!isValidUuid(signalId)) {
      return Response.json({ error: "Invalid signal_id format" }, { status: 400 });
    }

    const fileSize = file.size;
    if (fileSize > MAX_FILE_SIZE) {
      return Response.json({ error: "File size exceeds 100MB limit" }, { status: 400 });
    }

    const fileExtension = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return Response.json({ error: "Only CSV and JSON files are allowed" }, { status: 400 });
    }

    const signal = await supabaseAdmin
      .from("signals")
      .select("id")
      .eq("id", signalId)
      .single();

    if (signal.error || !signal.data) {
      return Response.json({ error: "Signal not found" }, { status: 404 });
    }

    const fileContent = await file.text();

    let dataPoints: SignalDataPoint[];
    try {
      if (fileExtension === '.csv') {
        const parser = new CsvParser();
        dataPoints = parser.parse(fileContent);
      } else {
        const parser = new JsonParser();
        dataPoints = parser.parse(fileContent);
      }
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : "Parse error";
      return Response.json({ error: `Failed to parse file: ${message}` }, { status: 400 });
    }

    if (dataPoints.length === 0) {
      return Response.json({ error: "No valid data points found in file" }, { status: 400 });
    }

    const result = await insertSignalData(signalId, dataPoints);

    return Response.json(result);
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

async function insertSignalData(signalId: string, dataPoints: SignalDataPoint[]): Promise<UploadResult> {
  const errors: string[] = [];
  let successCount = 0;

  const rows = dataPoints.map((dp) => ({
    signal_id: signalId,
    timestamp: dp.timestamp.toISOString(),
    value: dp.value,
    metadata: dp.metadata || {},
  }));

  const batchSize = 1000;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const { error } = await supabaseAdmin.from("signal_data").insert(batch);

    if (error) {
      errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
    } else {
      successCount += batch.length;
    }
  }

  return { success_count: successCount, errors };
}

function isValidUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
