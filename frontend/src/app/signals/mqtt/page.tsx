"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Loader2 } from "lucide-react"
import { MQTTConnectorForm } from "@/components/connectors/mqtt-connector-form"
import { supabase, getUserOrgId } from "@/lib/supabase"

export default function MQTTSignalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [signalName, setSignalName] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadOrg = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push("/login")
        return
      }
      const userOrgId = await getUserOrgId(session.user.id)
      setOrgId(userOrgId)
    }
    loadOrg()
  }, [router])

  const handleFormSubmit = async (values: {
    brokerUrl: string
    topic: string
    qos: string
    timestampField: string
    valueField: string
    metadataFields?: string
  }) => {
    if (!signalName.trim()) {
      setErrors({ name: "Signal name is required" })
      return
    }

    if (!orgId) return

    setLoading(true)
    try {
      const source_config = {
        broker_url: values.brokerUrl,
        topic: values.topic,
        qos: values.qos,
        timestamp_field: values.timestampField,
        value_field: values.valueField,
        metadata_fields: values.metadataFields?.split(",").map(f => f.trim()).filter(Boolean) || [],
      }

      console.log("Creating MQTT signal:", {
        name: signalName,
        source_type: "mqtt",
        source_config,
        org_id: orgId,
      })

      const { error } = await supabase
        .from("signals")
        .insert({
          name: signalName,
          source_type: "mqtt",
          source_config,
          org_id: orgId,
        })

      if (error) throw error

      router.push("/signals")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create signal")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.push("/signals")} className="mb-4 pl-0">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Signals
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create MQTT Signal</h1>
        <p className="text-muted-foreground mt-1">
          Configure a new signal from an MQTT topic subscription
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Signal Details</CardTitle>
            <CardDescription>Enter a name for your MQTT signal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Signal Name</Label>
              <Input
                id="name"
                placeholder="e.g., Temperature Sensor A"
                value={signalName}
                onChange={(e) => {
                  setSignalName(e.target.value)
                  if (errors.name) setErrors({ ...errors, name: "" })
                }}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>
          </CardContent>
        </Card>

        <MQTTConnectorForm
          onSubmit={handleFormSubmit}
          disabled={loading}
        />

        <div className="flex justify-end gap-4">
          <Button variant="outline" type="button" onClick={() => router.push("/signals")}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
