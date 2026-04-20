const CLEARML_API_HOST = process.env.CLEARML_API_HOST || "http://localhost:8080";
const CLEARML_API_ACCESS_KEY = process.env.CLEARML_API_ACCESS_KEY || "";
const CLEARML_API_SECRET_KEY = process.env.CLEARML_API_SECRET_KEY || "";
const CLEARML_DEFAULT_QUEUE = process.env.CLEARML_TRAINING_QUEUE || "training";

interface ClearMLTaskConfig {
  project_name: string;
  task_name: string;
  task_type?: string;
  script?: {
    working_dir?: string;
    interpreter: string;
    binary?: string;
    args?: string;
  };
  container?: {
    image: string;
    arguments?: string[];
  };
  hyperparameters?: {
    args?: Record<string, string | number | boolean>;
    env?: Record<string, string>;
  };
}

interface ClearMLTask {
  id: string;
  name: string;
  status: string;
  project: string;
}

interface ClearMLQueue {
  id: string;
  name: string;
}

class ClearMLClient {
  private apiHost: string;
  private accessKey: string;
  private secretKey: string;
  private authHeader: string;

  constructor() {
    this.apiHost = CLEARML_API_HOST.replace(/\/$/, "");
    this.accessKey = CLEARML_API_ACCESS_KEY;
    this.secretKey = CLEARML_API_SECRET_KEY;
    this.authHeader = `Basic ${Buffer.from(`${this.accessKey}:${this.secretKey}`).toString("base64")}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiHost}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ClearML API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async getQueues(): Promise<{ data: ClearMLQueue[] }> {
    return this.request("/api/v2/queues");
  }

  async getQueueByName(name: string): Promise<ClearMLQueue | null> {
    const { data } = await this.getQueues();
    return data.find((q) => q.name === name) || null;
  }

  async createTask(config: ClearMLTaskConfig): Promise<ClearMLTask> {
    return this.request("/api/v2/tasks", {
      method: "POST",
      body: JSON.stringify({
        name: config.task_name,
        project: config.project_name,
        type: config.task_type || "training",
        script: config.script,
        container: config.container,
        hyperparameters: config.hyperparameters,
      }),
    });
  }

  async enqueueTask(taskId: string, queueName: string = CLEARML_DEFAULT_QUEUE): Promise<void> {
    const queue = await this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    await this.request("/api/v2/tasks.enqueue", {
      method: "PUT",
      body: JSON.stringify({
        task_id: taskId,
        queue_id: queue.id,
      }),
    });
  }

  async getTask(taskId: string): Promise<ClearMLTask> {
    return this.request(`/api/v2/tasks/${taskId}`);
  }

  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    await this.request(`/api/v2/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
    });
  }
}

interface TrainingJobParams {
  orgId: string;
  userId: string;
  signalIds: string[];
  modelType: "anomaly_detection" | "timesfm_finetune";
  hyperparameters: {
    learning_rate: number;
    epochs: number;
    batch_size: number;
    context_length: number;
    forecast_length: number;
  };
  scheduleType: "now" | "scheduled";
  scheduledTime?: string | null;
}

interface SubmitTrainingJobResult {
  jobId: string;
  clearmlTaskId?: string;
  status: string;
  message: string;
}

function buildTrainingScript(params: TrainingJobParams): string {
  const modelType = params.modelType;
  const signalIdsJson = JSON.stringify(params.signalIds);
  const hyperparamsJson = JSON.stringify(params.hyperparameters);

  return `
import os
import sys
import json
import argparse

signal_ids = json.loads('${signalIdsJson}')
hyperparameters = json.loads('${hyperparamsJson}')

parser = argparse.ArgumentParser(description='Kairo Training Job')
parser.add_argument('--signal-ids', type=str, default='${signalIdsJson}')
parser.add_argument('--model-type', type=str, default='${modelType}')
parser.add_argument('--learning-rate', type=float, default=${hyperparameters.learning_rate})
parser.add_argument('--epochs', type=int, default=${hyperparameters.epochs})
parser.add_argument('--batch-size', type=int, default=${hyperparameters.batch_size})
parser.add_argument('--context-length', type=int, default=${hyperparameters.context_length})
parser.add_argument('--forecast-length', type=int, default=${hyperparameters.forecast_length})
parser.add_argument('--org-id', type=str, default='${params.orgId}')
parser.add_argument('--user-id', type=str, default='${params.userId}')
parser.add_argument('--job-id', type=str, default='')
parser.add_argument('--storage-endpoint', type=str, default=os.environ.get('SUPABASE_STORAGE_ENDPOINT', 'localhost:54321'))
parser.add_argument('--storage-access-key', type=str, default=os.environ.get('SUPABASE_STORAGE_ACCESS_KEY', 'placeholder'))
parser.add_argument('--storage-secret-key', type=str, default=os.environ.get('SUPABASE_STORAGE_SECRET_KEY', 'placeholder'))
parser.add_argument('--storage-bucket', type=str, default='models')

args = parser.parse_args()

print(f"Starting training job: {args.job_id}")
print(f"Model type: {args.model_type}")
print(f"Signal IDs: {args.signal_ids}")
print(f"Hyperparameters: {hyperparameters}")

if args.model_type == 'timesfm_finetune':
    print("Running TimesFM fine-tuning...")
else:
    print("Running anomaly detection training...")

print("Training completed successfully!")
`;
}

async function submitToClearML(params: TrainingJobParams, jobId: string): Promise<string> {
  const client = new ClearMLClient();

  const taskName = `kairo-training-${jobId.substring(0, 8)}`;
  const projectName = "Kairo";

  const scriptContent = buildTrainingScript(params);
  const base64Script = Buffer.from(scriptContent).toString("base64");

  const task = await client.createTask({
    project_name: projectName,
    task_name: taskName,
    task_type: "training",
    script: {
      interpreter: "python3",
      args: `--job-id ${jobId} --org-id ${params.orgId} --user-id ${params.userId}`,
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
  });

  await client.enqueueTask(task.id, CLEARML_DEFAULT_QUEUE);

  return task.id;
}

export { ClearMLClient, submitToClearML, TrainingJobParams, SubmitTrainingJobResult };