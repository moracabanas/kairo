"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  RotateCcw,
  Save,
  Zap,
  Scale,
  Target,
} from "lucide-react"

export interface PredictionConfig {
  enabled: boolean
  contextLength: number
  forecastLength: number
  frequency: number
  confidenceLevel: number
  autoRefresh: boolean
  refreshInterval: number
}

interface PredictionSettingsProps {
  signalId: string
  settings: PredictionConfig
  onSave: (settings: PredictionConfig) => void
  isLoading?: boolean
}

const DEFAULT_CONFIG: PredictionConfig = {
  enabled: false,
  contextLength: 512,
  forecastLength: 128,
  frequency: 3600,
  confidenceLevel: 0.95,
  autoRefresh: false,
  refreshInterval: 3600,
}

const FREQUENCY_OPTIONS = [
  { label: "1 minute", value: 60 },
  { label: "5 minutes", value: 300 },
  { label: "15 minutes", value: 900 },
  { label: "30 minutes", value: 1800 },
  { label: "1 hour", value: 3600 },
  { label: "6 hours", value: 21600 },
  { label: "24 hours", value: 86400 },
]

const PRESETS = {
  "Low latency": {
    contextLength: 64,
    forecastLength: 16,
    frequency: 60,
    confidenceLevel: 0.8,
  },
  Balanced: {
    contextLength: 512,
    forecastLength: 128,
    frequency: 3600,
    confidenceLevel: 0.95,
  },
  "High accuracy": {
    contextLength: 2048,
    forecastLength: 512,
    frequency: 21600,
    confidenceLevel: 0.99,
  },
}

interface ValidationErrors {
  contextLength?: string
  forecastLength?: string
  frequency?: string
  confidenceLevel?: string
  refreshInterval?: string
}

function validateConfig(config: PredictionConfig): ValidationErrors {
  const errors: ValidationErrors = {}

  if (config.contextLength < 64 || config.contextLength > 2048) {
    errors.contextLength = "Context length must be between 64 and 2048"
  }

  if (config.forecastLength < 16 || config.forecastLength > 512) {
    errors.forecastLength = "Forecast length must be between 16 and 512"
  }

  if (config.forecastLength > config.contextLength) {
    errors.forecastLength = "Forecast length cannot exceed context length"
  }

  const validFrequencies = FREQUENCY_OPTIONS.map((f) => f.value)
  if (!validFrequencies.includes(config.frequency)) {
    errors.frequency = "Please select a valid frequency"
  }

  if (config.confidenceLevel < 0.8 || config.confidenceLevel > 0.99) {
    errors.confidenceLevel = "Confidence level must be between 0.80 and 0.99"
  }

  if (config.autoRefresh) {
    const validIntervals = [60, 300, 900, 1800, 3600, 21600, 86400]
    if (!validIntervals.includes(config.refreshInterval)) {
      errors.refreshInterval = "Please select a valid refresh interval"
    }
  }

  return errors
}

export function PredictionSettings({
  signalId,
  settings,
  onSave,
  isLoading = false,
}: PredictionSettingsProps) {
  const [config, setConfig] = useState<PredictionConfig>(settings)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [hasChanges, setHasChanges] = useState(false)

  const handleChange = useCallback(
    <K extends keyof PredictionConfig>(key: K, value: PredictionConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }))
      setHasChanges(true)
      setErrors({})
    },
    []
  )

  const handleSave = useCallback(() => {
    const validationErrors = validateConfig(config)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    onSave(config)
    setHasChanges(false)
  }, [config, onSave])

  const handleReset = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
    setErrors({})
    setHasChanges(true)
  }, [])

  const handlePreset = useCallback(
    (preset: keyof typeof PRESETS) => {
      const presetConfig = PRESETS[preset]
      setConfig((prev) => ({
        ...prev,
        ...presetConfig,
      }))
      setErrors({})
      setHasChanges(true)
    },
    []
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prediction Settings</CardTitle>
        <CardDescription>
          Configure TimesFM parameters for signal {signalId}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enabled">Enable Predictions</Label>
            <p className="text-sm text-muted-foreground">
              Run TimesFM forecasting on this signal
            </p>
          </div>
          <Button
            id="enabled"
            variant={config.enabled ? "default" : "outline"}
            size="sm"
            onClick={() => handleChange("enabled", !config.enabled)}
            disabled={isLoading}
          >
            {config.enabled ? "Enabled" : "Disabled"}
          </Button>
        </div>

        {config.enabled && (
          <>
            <div className="space-y-3">
              <Label>Presets</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreset("Low latency")}
                  disabled={isLoading}
                  className="flex gap-1.5"
                >
                  <Zap className="size-3.5" />
                  Low latency
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreset("Balanced")}
                  disabled={isLoading}
                  className="flex gap-1.5"
                >
                  <Scale className="size-3.5" />
                    Balanced
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreset("High accuracy")}
                  disabled={isLoading}
                  className="flex gap-1.5"
                >
                  <Target className="size-3.5" />
                  High accuracy
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contextLength">Context Length</Label>
                <Input
                  id="contextLength"
                  type="number"
                  min={64}
                  max={2048}
                  step={64}
                  value={config.contextLength}
                  onChange={(e) =>
                    handleChange("contextLength", parseInt(e.target.value) || 0)
                  }
                  disabled={isLoading}
                />
                {errors.contextLength && (
                  <p className="text-xs text-destructive">{errors.contextLength}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Historical data points (64-2048). Higher values need more
                  memory.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="forecastLength">Forecast Length</Label>
                <Input
                  id="forecastLength"
                  type="number"
                  min={16}
                  max={512}
                  step={16}
                  value={config.forecastLength}
                  onChange={(e) =>
                    handleChange("forecastLength", parseInt(e.target.value) || 0)
                  }
                  disabled={isLoading}
                />
                {errors.forecastLength && (
                  <p className="text-xs text-destructive">{errors.forecastLength}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Future predictions (16-512). Cannot exceed context length.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Update Frequency</Label>
              <Select
                value={config.frequency.toString()}
                onValueChange={(value) =>
                  handleChange("frequency", parseInt(value))
                }
                disabled={isLoading}
              >
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.frequency && (
                <p className="text-xs text-destructive">{errors.frequency}</p>
              )}
              <p className="text-xs text-muted-foreground">
                How often to retrain and update forecasts
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="confidenceLevel">Confidence Level</Label>
                <span className="text-sm font-medium">
                  {Math.round(config.confidenceLevel * 100)}%
                </span>
              </div>
              <input
                id="confidenceLevel"
                type="range"
                min={80}
                max={99}
                step={1}
                value={Math.round(config.confidenceLevel * 100)}
                onChange={(e) =>
                  handleChange("confidenceLevel", parseInt(e.target.value) / 100)
                }
                disabled={isLoading}
                className="w-full"
              />
              {errors.confidenceLevel && (
                <p className="text-xs text-destructive">{errors.confidenceLevel}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Prediction interval confidence (80%-99%)
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoRefresh">Auto-refresh</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically refresh predictions
                  </p>
                </div>
                <Button
                  id="autoRefresh"
                  variant={config.autoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleChange("autoRefresh", !config.autoRefresh)}
                  disabled={isLoading}
                >
                  {config.autoRefresh ? "On" : "Off"}
                </Button>
              </div>

              {config.autoRefresh && (
                <div className="pl-4 space-y-2">
                  <Label htmlFor="refreshInterval">Refresh Interval</Label>
                  <Select
                    value={config.refreshInterval.toString()}
                    onValueChange={(value) =>
                      handleChange("refreshInterval", parseInt(value))
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger id="refreshInterval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value.toString()}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.refreshInterval && (
                    <p className="text-xs text-destructive">
                      {errors.refreshInterval}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isLoading || !hasChanges}
            className="flex gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            Reset to defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isLoading || !hasChanges || Object.keys(errors).length > 0}
            className="flex gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

