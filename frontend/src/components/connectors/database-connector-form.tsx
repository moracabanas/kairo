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
import { Loader2, Database, CheckCircle2, XCircle, Play } from "lucide-react"

const databaseFormSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().min(1, "Port must be at least 1").max(65535, "Port must be at most 65535"),
  database: z.string().min(1, "Database name is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().optional(),
  sslMode: z.enum(["disable", "require", "verify-ca", "verify-full"]),
  query: z.string().min(1, "Query is required"),
  refreshInterval: z.enum(["manual", "5s", "15s", "30s", "1m", "5m"]),
})

type DatabaseFormValues = z.infer<typeof databaseFormSchema>

interface DatabaseConnectorFormProps {
  onSubmit?: (values: DatabaseFormValues) => void
  initialValues?: Partial<DatabaseFormValues>
  disabled?: boolean
}

export function DatabaseConnectorForm({
  onSubmit,
  initialValues,
  disabled = false,
}: DatabaseConnectorFormProps) {
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [testMessage, setTestMessage] = useState<string>("")

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DatabaseFormValues>({
    resolver: zodResolver(databaseFormSchema),
    defaultValues: {
      host: initialValues?.host ?? "",
      port: initialValues?.port ?? 5432,
      database: initialValues?.database ?? "",
      username: initialValues?.username ?? "",
      password: initialValues?.password ?? "",
      sslMode: initialValues?.sslMode ?? "require",
      query: initialValues?.query ?? "",
      refreshInterval: initialValues?.refreshInterval ?? "manual",
    },
  })

  const sslMode = watch("sslMode")
  const refreshInterval = watch("refreshInterval")

  const handleTestConnection = async (data: DatabaseFormValues) => {
    setTestStatus("testing")
    setTestMessage("")
    try {
      const response = await fetch("/api/connectors/database/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const result = await response.json()
      if (response.ok) {
        setTestStatus("success")
        setTestMessage(result.message || "Connection successful")
      } else {
        setTestStatus("error")
        setTestMessage(result.error || "Connection failed")
      }
    } catch {
      setTestStatus("error")
      setTestMessage("Failed to test connection")
    }
  }

  const onFormSubmit = (data: DatabaseFormValues) => {
    onSubmit?.(data)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="size-5" />
          Database Connector
        </CardTitle>
        <CardDescription>
          Configure a PostgreSQL database connection for your signal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                placeholder="localhost"
                disabled={disabled || isSubmitting}
                {...register("host")}
              />
              {errors.host && (
                <p className="text-xs text-destructive">{errors.host.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                placeholder="5432"
                disabled={disabled || isSubmitting}
                {...register("port")}
              />
              {errors.port && (
                <p className="text-xs text-destructive">{errors.port.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="database">Database Name</Label>
              <Input
                id="database"
                placeholder="mydb"
                disabled={disabled || isSubmitting}
                {...register("database")}
              />
              {errors.database && (
                <p className="text-xs text-destructive">{errors.database.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="postgres"
                disabled={disabled || isSubmitting}
                {...register("username")}
              />
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Leave empty for no auth"
                disabled={disabled || isSubmitting}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sslMode">SSL Mode</Label>
              <Select
                value={sslMode}
                onValueChange={(v) => setValue("sslMode", v as DatabaseFormValues["sslMode"])}
                disabled={disabled || isSubmitting}
              >
                <SelectTrigger id="sslMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disable">Disable</SelectItem>
                  <SelectItem value="require">Require</SelectItem>
                  <SelectItem value="verify-ca">Verify CA</SelectItem>
                  <SelectItem value="verify-full">Verify Full</SelectItem>
                </SelectContent>
              </Select>
              {errors.sslMode && (
                <p className="text-xs text-destructive">{errors.sslMode.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="query">Query</Label>
            <textarea
              id="query"
              className="min-h-[100px] w-full rounded-3xl border border-transparent bg-input/50 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="SELECT * FROM my_table LIMIT 10"
              disabled={disabled || isSubmitting}
              {...register("query")}
            />
            {errors.query && (
              <p className="text-xs text-destructive">{errors.query.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="refreshInterval">Refresh Interval</Label>
            <Select
              value={refreshInterval}
              onValueChange={(v) => setValue("refreshInterval", v as DatabaseFormValues["refreshInterval"])}
              disabled={disabled || isSubmitting}
            >
              <SelectTrigger id="refreshInterval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="5s">5 seconds</SelectItem>
                <SelectItem value="15s">15 seconds</SelectItem>
                <SelectItem value="30s">30 seconds</SelectItem>
                <SelectItem value="1m">1 minute</SelectItem>
                <SelectItem value="5m">5 minutes</SelectItem>
              </SelectContent>
            </Select>
            {errors.refreshInterval && (
              <p className="text-xs text-destructive">{errors.refreshInterval.message}</p>
            )}
          </div>

          {testStatus === "success" && (
            <div className="flex items-center gap-2 rounded-3xl bg-green-500/10 p-3 text-sm text-green-600">
              <CheckCircle2 className="size-4" />
              {testMessage}
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
              onClick={handleSubmit(handleTestConnection)}
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
                  Test Connection
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
