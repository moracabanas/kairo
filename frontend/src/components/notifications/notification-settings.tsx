"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bell,
  Mail,
  Webhook,
  Zap,
  Radio,
  Settings2,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface NotificationChannel {
  id: string;
  channel_type: "email" | "webhook" | "telegram" | "mqtt" | "mcp";
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const CHANNEL_TYPES = [
  { value: "email", label: "Email", icon: Mail },
  { value: "webhook", label: "Webhook", icon: Webhook },
  { value: "telegram", label: "Telegram", icon: Zap },
  { value: "mqtt", label: "MQTT", icon: Radio },
  { value: "mcp", label: "MCP", icon: Settings2 },
] as const;

const channelColors: Record<string, string> = {
  email: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  webhook: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  telegram: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  mqtt: "bg-green-500/10 text-green-600 border-green-500/20",
  mcp: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
};

interface CreateChannelForm {
  channel_type: NotificationChannel["channel_type"];
  name: string;
  email?: string;
  url?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  mqtt_topic?: string;
  mcp_server_url?: string;
}

export function NotificationSettings() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateChannelForm>({
    channel_type: "email",
    name: "",
  });

  const fetchChannels = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch("/api/notifications/channels", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch channels");
      }

      const data = await response.json();
      setChannels(data.channels || data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  async function toggleChannel(channelId: string, currentEnabled: boolean) {
    try {
      setTogglingId(channelId);
      setError(null);
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/notifications/channels/${channelId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update channel");
      }

      setChannels((prev) =>
        prev.map((channel) =>
          channel.id === channelId
            ? { ...channel, enabled: !currentEnabled }
            : channel
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update channel";
      setError(message);
      console.error("Error toggling channel:", err);
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteChannel(channelId: string) {
    try {
      setDeleteLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/notifications/channels/${channelId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete channel");
      }

      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Error deleting channel:", err);
    } finally {
      setDeleteLoading(false);
    }
  }

  function buildConfig(form: CreateChannelForm): Record<string, unknown> {
    switch (form.channel_type) {
      case "email":
        return { email: form.email };
      case "webhook":
        return { url: form.url };
      case "telegram":
        return {
          bot_token: form.telegram_bot_token,
          chat_id: form.telegram_chat_id,
        };
      case "mqtt":
        return { topic: form.mqtt_topic };
      case "mcp":
        return { server_url: form.mcp_server_url };
      default:
        return {};
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setCreateError("Name is required");
      return;
    }

    setCreateLoading(true);
    setCreateError(null);

    try {
      const token = localStorage.getItem("token");
      const config = buildConfig(formData);

      const response = await fetch("/api/notifications/channels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          channel_type: formData.channel_type,
          name: formData.name.trim(),
          config,
          enabled: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create channel");
      }

      const data = await response.json();
      const newChannel = data.channel || data.data;
      if (newChannel) {
        setChannels((prev) => [newChannel, ...prev]);
      }
      setDialogOpen(false);
      setFormData({ channel_type: "email", name: "" });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create channel");
    } finally {
      setCreateLoading(false);
    }
  }

  function openCreateDialog() {
    setFormData({ channel_type: "email", name: "" });
    setCreateError(null);
    setDialogOpen(true);
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6 text-destructive">
          <AlertCircle className="size-5" />
          <span>{error}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="size-5" />
              <CardTitle>Notification Channels</CardTitle>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Channel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Notification Channel</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  {createError && (
                    <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                      {createError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="channel_type">Channel Type</Label>
                    <Select
                      value={formData.channel_type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, channel_type: value as NotificationChannel["channel_type"] })
                      }
                    >
                      <SelectTrigger id="channel_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHANNEL_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="My Email Channel"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  {formData.channel_type === "email" && (
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="alerts@example.com"
                        value={formData.email || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                  )}
                  {formData.channel_type === "webhook" && (
                    <div className="space-y-2">
                      <Label htmlFor="url">Webhook URL</Label>
                      <Input
                        id="url"
                        type="url"
                        placeholder="https://hooks.example.com/..."
                        value={formData.url || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, url: e.target.value })
                        }
                      />
                    </div>
                  )}
                  {formData.channel_type === "telegram" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="bot_token">Bot Token</Label>
                        <Input
                          id="bot_token"
                          type="password"
                          placeholder="123456:ABC-DEF..."
                          value={formData.telegram_bot_token || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, telegram_bot_token: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="chat_id">Chat ID</Label>
                        <Input
                          id="chat_id"
                          placeholder="-1001234567890"
                          value={formData.telegram_chat_id || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, telegram_chat_id: e.target.value })
                          }
                        />
                      </div>
                    </>
                  )}
                  {formData.channel_type === "mqtt" && (
                    <div className="space-y-2">
                      <Label htmlFor="mqtt_topic">MQTT Topic</Label>
                      <Input
                        id="mqtt_topic"
                        placeholder="kairo/alerts"
                        value={formData.mqtt_topic || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, mqtt_topic: e.target.value })
                        }
                      />
                    </div>
                  )}
                  {formData.channel_type === "mcp" && (
                    <div className="space-y-2">
                      <Label htmlFor="mcp_server_url">MCP Server URL</Label>
                      <Input
                        id="mcp_server_url"
                        type="url"
                        placeholder="http://localhost:8080/mcp"
                        value={formData.mcp_server_url || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, mcp_server_url: e.target.value })
                        }
                      />
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createLoading}>
                      {createLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Channel"
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>
            Manage your notification delivery channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No channels configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first notification channel to start receiving alerts
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Channel
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {channels.map((channel) => {
                const channelType = CHANNEL_TYPES.find(
                  (t) => t.value === channel.channel_type
                );
                const Icon = channelType?.icon || Bell;
                const colorClass = channelColors[channel.channel_type] || "";

                return (
                  <div
                    key={channel.id}
                    className="flex items-center justify-between rounded-xl border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`rounded-lg p-2 ${colorClass}`}>
                        <Icon className="size-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium">{channel.name}</div>
                        <Badge variant="outline" className={colorClass}>
                          {channel.channel_type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteConfirmId(channel.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={channel.enabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleChannel(channel.id, channel.enabled)}
                        disabled={togglingId === channel.id}
                      >
                        {togglingId === channel.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : channel.enabled ? (
                          "Enabled"
                        ) : (
                          "Disabled"
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete this notification channel? This action
              cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirmId && deleteChannel(deleteConfirmId)}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Channel"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}