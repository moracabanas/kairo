"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, Clock, DollarSign, AlertCircle, Check } from "lucide-react";
import { supabase, getUserOrgId } from "@/lib/supabase";

const trainingSchema = z.object({
  signal_ids: z.array(z.string()).min(1, "Select at least one signal"),
  model_type: z.enum(["anomaly_detection", "timesfm_finetune"]),
  learning_rate: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0 && parseFloat(val) <= 1,
    "Must be a positive number between 0 and 1"
  ),
  epochs: z.string().refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) <= 1000,
    "Must be a positive integer between 1 and 1000"
  ),
  batch_size: z.string().refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) <= 512,
    "Must be a positive integer between 1 and 512"
  ),
  context_length: z.string().refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) <= 4096,
    "Must be a positive integer between 1 and 4096"
  ),
  forecast_length: z.string().refine(
    (val) => !isNaN(parseInt(val)) && parseInt(val) > 0 && parseInt(val) <= 512,
    "Must be a positive integer between 1 and 512"
  ),
  schedule_type: z.enum(["now", "scheduled"]),
  scheduled_time: z.string().optional(),
}).refine(
  (data) => {
    if (data.schedule_type === "scheduled" && !data.scheduled_time) {
      return false;
    }
    return true;
  },
  {
    message: "Scheduled time is required when scheduling training",
    path: ["scheduled_time"],
  }
);

export type TrainingConfig = z.infer<typeof trainingSchema>;

interface Signal {
  id: string;
  name: string;
  source_type: "database" | "mqtt" | "file" | "log";
  org_id: string;
  created_at: string;
  updated_at: string;
  data_points?: number;
}

interface CostEstimate {
  estimatedCost: number;
  estimatedDurationMinutes: number;
  signalCount: number;
  totalDataPoints: number;
}

const MODEL_OPTIONS = [
  { value: "anomaly_detection" as const, label: "Anomaly Detection", description: "Detect anomalies in time series data" },
  { value: "timesfm_finetune" as const, label: "TimesFM Fine-tune", description: "Fine-tune Google's TimesFM model" },
];

const DEFAULT_VALUES: Partial<TrainingConfig> = {
  model_type: "anomaly_detection",
  learning_rate: "0.001",
  epochs: "10",
  batch_size: "32",
  context_length: "128",
  forecast_length: "24",
  schedule_type: "now",
  signal_ids: [],
};

function calculateCost(signals: Signal[], modelType: TrainingConfig["model_type"], epochs: number): CostEstimate {
  const totalDataPoints = signals.reduce((sum, s) => sum + (s.data_points || 10000), 0);
  const baseCostPer100kPoints = modelType === "timesfm_finetune" ? 0.15 : 0.05;
  const epochMultiplier = Math.ceil(epochs / 10);
  const estimatedCost = (totalDataPoints / 100000) * baseCostPer100kPoints * epochMultiplier;
  const estimatedDurationMinutes = Math.ceil((totalDataPoints / 10000) * epochMultiplier * (modelType === "timesfm_finetune" ? 2 : 1));

  return {
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    estimatedDurationMinutes,
    signalCount: signals.length,
    totalDataPoints,
  };
}

export function TrainingConfigForm() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TrainingConfig>({
    resolver: zodResolver(trainingSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const watchedSignals = watch("signal_ids");
  const watchedModelType = watch("model_type");
  const watchedEpochs = watch("epochs");
  const watchedScheduleType = watch("schedule_type");

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const userOrgId = await getUserOrgId(session.user.id);
        if (!userOrgId) return;
        setOrgId(userOrgId);

        const mockSignals: Signal[] = [
          { id: "1", name: "Production Sensor A", source_type: "database", org_id: userOrgId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), data_points: 50000 },
          { id: "2", name: "Temperature Monitor", source_type: "mqtt", org_id: userOrgId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), data_points: 30000 },
          { id: "3", name: "Sales Data Feed", source_type: "file", org_id: userOrgId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), data_points: 80000 },
          { id: "4", name: "Application Logs", source_type: "log", org_id: userOrgId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), data_points: 120000 },
          { id: "5", name: "Stock Prices", source_type: "database", org_id: userOrgId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), data_points: 45000 },
          { id: "6", name: "Weather Data", source_type: "mqtt", org_id: userOrgId, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), data_points: 25000 },
        ];

        setSignals(mockSignals);
      } catch (err) {
        console.error("Failed to load signals:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const selectedSignals = useMemo(() => {
    return signals.filter((s) => watchedSignals?.includes(s.id));
  }, [signals, watchedSignals]);

  const costEstimate = useMemo(() => {
    if (selectedSignals.length === 0) return null;
    const epochs = parseInt(watchedEpochs) || 10;
    return calculateCost(selectedSignals, watchedModelType || "anomaly_detection", epochs);
  }, [selectedSignals, watchedModelType, watchedEpochs]);

  const onSubmit = async (data: TrainingConfig) => {
    if (!orgId) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const trainingJob = {
        org_id: orgId,
        signal_ids: data.signal_ids,
        model_type: data.model_type,
        hyperparameters: {
          learning_rate: parseFloat(data.learning_rate),
          epochs: parseInt(data.epochs),
          batch_size: parseInt(data.batch_size),
          context_length: parseInt(data.context_length),
          forecast_length: parseInt(data.forecast_length),
        },
        schedule_type: data.schedule_type,
        scheduled_time: data.schedule_type === "scheduled" ? data.scheduled_time : null,
        status: data.schedule_type === "now" ? "running" : "scheduled",
      };

      console.log("Creating training job:", trainingJob);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create training job");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSignal = (signalId: string) => {
    const current = watch("signal_ids") || [];
    if (current.includes(signalId)) {
      setValue("signal_ids", current.filter((id) => id !== signalId));
    } else {
      setValue("signal_ids", [...current, signalId]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Select Signals
          </CardTitle>
          <CardDescription>
            Choose the signals to use for training. Select one or more signals from your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors.signal_ids && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {errors.signal_ids.message}
            </div>
          )}

          <div className="grid gap-3">
            {signals.map((signal) => {
              const isSelected = watchedSignals?.includes(signal.id);
              return (
                <button
                  key={signal.id}
                  type="button"
                  onClick={() => toggleSignal(signal.id)}
                  className={`flex items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div>
                      <p className="font-medium">{signal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {signal.source_type} • {signal.data_points?.toLocaleString() || "—"} data points
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{signal.source_type}</Badge>
                </button>
              );
            })}
          </div>

          {selectedSignals.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-sm text-muted-foreground">Selected:</span>
              {selectedSignals.map((s) => (
                <Badge key={s.id} variant="secondary">
                  {s.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model Configuration</CardTitle>
          <CardDescription>
            Configure the model type and hyperparameters for training
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Model Type</Label>
            <Controller
              name="model_type"
              control={control}
              render={({ field }) => (
                <div className="grid gap-3">
                  {MODEL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => field.onChange(option.value)}
                      className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                        field.value === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div
                        className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                          field.value === option.value
                            ? "border-primary bg-primary"
                            : "border-muted-foreground"
                        }`}
                      >
                        {field.value === option.value && (
                          <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="learning_rate">Learning Rate</Label>
              <Input
                id="learning_rate"
                type="number"
                step="0.0001"
                min="0.0001"
                max="1"
                {...register("learning_rate")}
              />
              {errors.learning_rate && (
                <p className="text-xs text-destructive">{errors.learning_rate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="epochs">Epochs</Label>
              <Input
                id="epochs"
                type="number"
                min="1"
                max="1000"
                {...register("epochs")}
              />
              {errors.epochs && (
                <p className="text-xs text-destructive">{errors.epochs.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch_size">Batch Size</Label>
              <Input
                id="batch_size"
                type="number"
                min="1"
                max="512"
                {...register("batch_size")}
              />
              {errors.batch_size && (
                <p className="text-xs text-destructive">{errors.batch_size.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="context_length">Context Length</Label>
              <Input
                id="context_length"
                type="number"
                min="1"
                max="4096"
                {...register("context_length")}
              />
              {errors.context_length && (
                <p className="text-xs text-destructive">{errors.context_length.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="forecast_length">Forecast Length</Label>
              <Input
                id="forecast_length"
                type="number"
                min="1"
                max="512"
                {...register("forecast_length")}
              />
              {errors.forecast_length && (
                <p className="text-xs text-destructive">{errors.forecast_length.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Training Schedule
          </CardTitle>
          <CardDescription>
            Choose when to run the training job
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Controller
              name="schedule_type"
              control={control}
              render={({ field }) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => field.onChange("now")}
                    className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                      field.value === "now"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        field.value === "now"
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      }`}
                    >
                      {field.value === "now" && (
                        <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Run Now</p>
                      <p className="text-xs text-muted-foreground">Start training immediately</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => field.onChange("scheduled")}
                    className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                      field.value === "scheduled"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        field.value === "scheduled"
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      }`}
                    >
                      {field.value === "scheduled" && (
                        <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Schedule</p>
                      <p className="text-xs text-muted-foreground">Run at a specific time</p>
                    </div>
                  </button>
                </div>
              )}
            />
          </div>

          {watchedScheduleType === "scheduled" && (
            <div className="space-y-2">
              <Label htmlFor="scheduled_time">Scheduled Time</Label>
              <Input
                id="scheduled_time"
                type="datetime-local"
                {...register("scheduled_time")}
              />
              {errors.scheduled_time && (
                <p className="text-xs text-destructive">{errors.scheduled_time.message}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {costEstimate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Estimated Cost
            </CardTitle>
            <CardDescription>
              Based on {costEstimate.signalCount} signal(s) with {costEstimate.totalDataPoints.toLocaleString()} total data points
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-4 text-center">
                <p className="text-2xl font-bold">${costEstimate.estimatedCost.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Estimated Cost</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4 text-center">
                <p className="text-2xl font-bold">{costEstimate.estimatedDurationMinutes}</p>
                <p className="text-xs text-muted-foreground">Est. Duration (min)</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4 text-center">
                <p className="text-2xl font-bold">{costEstimate.signalCount}</p>
                <p className="text-xs text-muted-foreground">Signals</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {submitError && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-4 w-4" />
          {submitError}
        </div>
      )}

      {submitSuccess && (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-4 text-green-600">
          <Check className="h-4 w-4" />
          Training job created successfully!
        </div>
      )}

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {watchedScheduleType === "now" ? "Start Training" : "Schedule Training"}
        </Button>
      </div>
    </form>
  );
}