"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Database, MessageSquare, File, FileText } from "lucide-react";
import { supabase, getUserOrgId } from "@/lib/supabase";

type SourceType = "database" | "mqtt" | "file" | "log";

interface DatabaseConfig {
  host: string;
  port: string;
  database: string;
  query: string;
  username: string;
  password: string;
}

interface MQTTConfig {
  broker_url: string;
  topic: string;
  qos: string;
}

interface FileConfig {
  file_path: string;
  format: "csv" | "json";
}

interface LogConfig {
  log_path: string;
  format: "json" | "text";
}

interface FormData {
  name: string;
  source_type: SourceType;
  database: DatabaseConfig;
  mqtt: MQTTConfig;
  file: FileConfig;
  log: LogConfig;
}

const SOURCE_TYPES: { value: SourceType; label: string; icon: typeof Database }[] = [
  { value: "database", label: "Database", icon: Database },
  { value: "mqtt", label: "MQTT", icon: MessageSquare },
  { value: "file", label: "File", icon: File },
  { value: "log", label: "Log", icon: FileText },
];

const initialFormData: FormData = {
  name: "",
  source_type: "database",
  database: { host: "", port: "5432", database: "", query: "", username: "", password: "" },
  mqtt: { broker_url: "", topic: "", qos: "0" },
  file: { file_path: "", format: "csv" },
  log: { log_path: "", format: "json" },
};

export default function NewSignalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadOrg = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push("/login");
        return;
      }
      const userOrgId = await getUserOrgId(session.user.id);
      setOrgId(userOrgId);
    };
    loadOrg();
  }, [router]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (formData.source_type === "database") {
      if (!formData.database.host.trim()) newErrors["database.host"] = "Host is required";
      if (!formData.database.port.trim()) newErrors["database.port"] = "Port is required";
      if (!formData.database.database.trim()) newErrors["database.database"] = "Database is required";
      if (!formData.database.query.trim()) newErrors["database.query"] = "Query is required";
    }

    if (formData.source_type === "mqtt") {
      if (!formData.mqtt.broker_url.trim()) newErrors["mqtt.broker_url"] = "Broker URL is required";
      if (!formData.mqtt.topic.trim()) newErrors["mqtt.topic"] = "Topic is required";
    }

    if (formData.source_type === "file") {
      if (!formData.file.file_path.trim()) newErrors["file.file_path"] = "File path is required";
    }

    if (formData.source_type === "log") {
      if (!formData.log.log_path.trim()) newErrors["log.log_path"] = "Log path is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !orgId) return;

    setLoading(true);
    try {
      let source_config: Record<string, string> = {};

      switch (formData.source_type) {
        case "database":
          source_config = {
            host: formData.database.host,
            port: formData.database.port,
            database: formData.database.database,
            query: formData.database.query,
            username: formData.database.username,
            password: formData.database.password,
          };
          break;
        case "mqtt":
          source_config = {
            broker_url: formData.mqtt.broker_url,
            topic: formData.mqtt.topic,
            qos: formData.mqtt.qos,
          };
          break;
        case "file":
          source_config = {
            file_path: formData.file.file_path,
            format: formData.file.format,
          };
          break;
        case "log":
          source_config = {
            log_path: formData.log.log_path,
            format: formData.log.format,
          };
          break;
      }

      console.log("Creating signal:", {
        name: formData.name,
        source_type: formData.source_type,
        source_config,
        org_id: orgId,
      });

      router.push("/signals");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create signal");
    } finally {
      setLoading(false);
    }
  };

  const updateDatabaseConfig = (key: keyof DatabaseConfig, value: string) => {
    setFormData({
      ...formData,
      database: { ...formData.database, [key]: value },
    });
  };

  const updateMqttConfig = (key: keyof MQTTConfig, value: string) => {
    setFormData({
      ...formData,
      mqtt: { ...formData.mqtt, [key]: value },
    });
  };

  const updateFileConfig = (key: keyof FileConfig, value: string) => {
    setFormData({
      ...formData,
      file: { ...formData.file, [key]: value },
    });
  };

  const updateLogConfig = (key: keyof LogConfig, value: string) => {
    setFormData({
      ...formData,
      log: { ...formData.log, [key]: value },
    });
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.push("/signals")} className="mb-4 pl-0">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Signals
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create New Signal</h1>
        <p className="text-muted-foreground mt-1">
          Configure a new data signal for your organization
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Enter the basic details for your signal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Signal Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Production Sensor A"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label>Source Type</Label>
                <Select
                  value={formData.source_type}
                  onValueChange={(value: SourceType) =>
                    setFormData({ ...formData, source_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a source type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((type) => {
                      const Icon = type.icon;
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {type.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {formData.source_type === "database" && "Database Configuration"}
                {formData.source_type === "mqtt" && "MQTT Configuration"}
                {formData.source_type === "file" && "File Configuration"}
                {formData.source_type === "log" && "Log Configuration"}
              </CardTitle>
              <CardDescription>
                {formData.source_type === "database" && "Configure database connection settings"}
                {formData.source_type === "mqtt" && "Configure MQTT broker and topic"}
                {formData.source_type === "file" && "Configure file path and format"}
                {formData.source_type === "log" && "Configure log file path and format"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {formData.source_type === "database" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="db-host">Host</Label>
                      <Input
                        id="db-host"
                        placeholder="localhost"
                        value={formData.database.host}
                        onChange={(e) => updateDatabaseConfig("host", e.target.value)}
                      />
                      {errors["database.host"] && (
                        <p className="text-sm text-red-500">{errors["database.host"]}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="db-port">Port</Label>
                      <Input
                        id="db-port"
                        placeholder="5432"
                        value={formData.database.port}
                        onChange={(e) => updateDatabaseConfig("port", e.target.value)}
                      />
                      {errors["database.port"] && (
                        <p className="text-sm text-red-500">{errors["database.port"]}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="db-database">Database Name</Label>
                    <Input
                      id="db-database"
                      placeholder="my_database"
                      value={formData.database.database}
                      onChange={(e) => updateDatabaseConfig("database", e.target.value)}
                    />
                    {errors["database.database"] && (
                      <p className="text-sm text-red-500">{errors["database.database"]}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="db-query">Query</Label>
                    <Input
                      id="db-query"
                      placeholder="SELECT * FROM metrics"
                      value={formData.database.query}
                      onChange={(e) => updateDatabaseConfig("query", e.target.value)}
                    />
                    {errors["database.query"] && (
                      <p className="text-sm text-red-500">{errors["database.query"]}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="db-username">Username (optional)</Label>
                      <Input
                        id="db-username"
                        placeholder="postgres"
                        value={formData.database.username}
                        onChange={(e) => updateDatabaseConfig("username", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="db-password">Password (optional)</Label>
                      <Input
                        id="db-password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.database.password}
                        onChange={(e) => updateDatabaseConfig("password", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.source_type === "mqtt" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-broker">Broker URL</Label>
                    <Input
                      id="mqtt-broker"
                      placeholder="mqtt://localhost:1883"
                      value={formData.mqtt.broker_url}
                      onChange={(e) => updateMqttConfig("broker_url", e.target.value)}
                    />
                    {errors["mqtt.broker_url"] && (
                      <p className="text-sm text-red-500">{errors["mqtt.broker_url"]}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-topic">Topic</Label>
                    <Input
                      id="mqtt-topic"
                      placeholder="sensors/+/data"
                      value={formData.mqtt.topic}
                      onChange={(e) => updateMqttConfig("topic", e.target.value)}
                    />
                    {errors["mqtt.topic"] && (
                      <p className="text-sm text-red-500">{errors["mqtt.topic"]}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-qos">QoS</Label>
                    <Select
                      value={formData.mqtt.qos}
                      onValueChange={(value) => updateMqttConfig("qos", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 - At most once</SelectItem>
                        <SelectItem value="1">1 - At least once</SelectItem>
                        <SelectItem value="2">2 - Exactly once</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {formData.source_type === "file" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file-path">File Path</Label>
                    <Input
                      id="file-path"
                      placeholder="/data/signal_data.csv"
                      value={formData.file.file_path}
                      onChange={(e) => updateFileConfig("file_path", e.target.value)}
                    />
                    {errors["file.file_path"] && (
                      <p className="text-sm text-red-500">{errors["file.file_path"]}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file-format">Format</Label>
                    <Select
                      value={formData.file.format}
                      onValueChange={(value: "csv" | "json") => updateFileConfig("format", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {formData.source_type === "log" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="log-path">Log Path</Label>
                    <Input
                      id="log-path"
                      placeholder="/var/log/application.log"
                      value={formData.log.log_path}
                      onChange={(e) => updateLogConfig("log_path", e.target.value)}
                    />
                    {errors["log.log_path"] && (
                      <p className="text-sm text-red-500">{errors["log.log_path"]}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="log-format">Format</Label>
                    <Select
                      value={formData.log.format}
                      onValueChange={(value: "json" | "text") => updateLogConfig("format", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="text">Plain Text</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" type="button" onClick={() => router.push("/signals")}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Signal
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
