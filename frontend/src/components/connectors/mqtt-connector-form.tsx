"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Loader2, MessageSquare, CheckCircle2, XCircle, Play, Plus, X } from "lucide-react"

const mqttFormSchema = z.object({
  brokerUrl: z.string().min(1, "Broker URL is required"),
  topic: z.string().min(1, "Topic is required"),
  qos: z.enum(["0", "1", "2"]),
  timestampField: z.string().min(1, "Timestamp field is required"),
  valueField: z.string().min(1, "Value field is required"),
  metadataFields: z.string().optional(),
})

type MQTTFormValues = z.infer<typeof mqttFormSchema>

interface MQTTConnectorFormProps {
  onSubmit?: (values: MQTTFormValues) => void
  initialValues?: Partial<MQTTFormValues>
  disabled?: boolean
}

export function MQTTConnectorForm({
  onSubmit,
  initialValues,
  disabled = false,
}: MQTTConnectorFormProps) {
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [testMessage, setTestMessage] = useState<string>("")
  const [sampleMessages, setSampleMessages] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MQTTFormValues>({
    resolver: zodResolver(mqttFormSchema),
    defaultValues: {
      brokerUrl: initialValues?.brokerUrl ?? "ws://localhost:1884",
      topic: initialValues?.topic ?? "",
      qos: initialValues?.qos ?? "0",
      timestampField: initialValues?.timestampField ?? "timestamp",
      valueField: initialValues?.valueField ?? "value",
      metadataFields: initialValues?.metadataFields ?? "",
    },
  })

  const qos = watch("qos")

  const handleTestSubscription = async (data: MQTTFormValues) => {
    setTestStatus("testing")
    setTestMessage("")
    setSampleMessages([])
    try {
      const response = await fetch("/api/connectors/mqtt/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const result = await response.json()
      if (response.ok) {
        setTestStatus("success")
        setTestMessage(result.message || "Subscription successful")
        if (result.samples) {
          setSampleMessages(result.samples)
        }
      } else {
        setTestStatus("error")
        setTestMessage(result.error || "Subscription failed")
      }
    } catch {
      setTestStatus("error")
      setTestMessage("Failed to test subscription")
    }
  }

  const onFormSubmit = (data: MQTTFormValues) => {
    onSubmit?.(data)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-5" />
          MQTT Connector
        </CardTitle>
        <CardDescription>
          Configure an MQTT topic subscription for your signal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brokerUrl">Broker URL</Label>
              <Input
                id="brokerUrl"
                placeholder="ws://localhost:1884"
                disabled={disabled || isSubmitting}
                {...register("brokerUrl")}
              />
              {errors.brokerUrl && (
                <p className="text-xs text-destructive">{errors.brokerUrl.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="qos">QoS</Label>
              <Select
                value={qos}
                onValueChange={(v) => setValue("qos", v as MQTTFormValues["qos"])}
                disabled={disabled || isSubmitting}
              >
                <SelectTrigger id="qos">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 - At most once</SelectItem>
                  <SelectItem value="1">1 - At least once</SelectItem>
                  <SelectItem value="2">2 - Exactly once</SelectItem>
                </SelectContent>
              </Select>
              {errors.qos && (
                <p className="text-xs text-destructive">{errors.qos.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              placeholder="sensors/temperature/#"
              disabled={disabled || isSubmitting}
              {...register("topic")}
            />
            {errors.topic && (
              <p className="text-xs text-destructive">{errors.topic.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Use # for multi-level wildcard, + for single-level
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label>Payload Schema</Label>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timestampField">Timestamp Field</Label>
                <Input
                  id="timestampField"
                  placeholder="timestamp"
                  disabled={disabled || isSubmitting}
                  {...register("timestampField")}
                />
                {errors.timestampField && (
                  <p className="text-xs text-destructive">{errors.timestampField.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="valueField">Value Field</Label>
                <Input
                  id="valueField"
                  placeholder="value"
                  disabled={disabled || isSubmitting}
                  {...register("valueField")}
                />
                {errors.valueField && (
                  <p className="text-xs text-destructive">{errors.valueField.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="metadataFields">Metadata Fields (optional)</Label>
              <Input
                id="metadataFields"
                placeholder="Comma-separated: sensor_id, location, unit"
                disabled={disabled || isSubmitting}
                {...register("metadataFields")}
              />
              {errors.metadataFields && (
                <p className="text-xs text-destructive">{errors.metadataFields.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Additional fields to store as metadata
              </p>
            </div>
          </div>

          {testStatus === "success" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-3xl bg-green-500/10 p-3 text-sm text-green-600">
                <CheckCircle2 className="size-4" />
                {testMessage}
              </div>
              {sampleMessages.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Sample Messages</Label>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-3xl bg-muted/50 p-3">
                    {sampleMessages.map((msg, i) => (
                      <pre key={i} className="overflow-x-auto text-xs">
                        {msg}
                      </pre>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {testStatus === "error" && (
            <div className="flex items-center gap-2 rounded-3xl bg-destructive/10 p-3 text-sm text-destructive">
              <XCircle className="size-4" />
              {testMessage}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={disabled || isSubmitting || testStatus === "testing"}
              onClick={handleSubmit(handleTestSubscription)}
              className="flex-1"
            >
              {testStatus === "testing" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  Test Subscription
                </>
              )}
            </Button>
            <Button
              type="submit"
              disabled={disabled || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
