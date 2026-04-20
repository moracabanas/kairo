"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Tag, Clock, Plus, X } from "lucide-react";

export interface Label {
  id: string;
  signal_id: string;
  start_time: Date;
  end_time: Date;
  label_type: "normal" | "anomaly" | "custom";
  tag_id: string | null;
  tag_name?: string;
  tag_color?: string;
  notes: string | null;
  created_at: Date;
}

export interface LabelTag {
  id: string;
  name: string;
  color: string;
}

export interface LabelSelectorProps {
  signalId: string;
  timeRange: { start: Date; end: Date };
  onLabelCreated: (label: Label) => void;
  existingTags?: LabelTag[];
  recentLabels?: Label[];
}

type LabelType = "normal" | "anomaly" | "custom";

const LABEL_TYPE_OPTIONS: { value: LabelType; label: string; description: string }[] = [
  { value: "normal", label: "Normal", description: "Normal operating region" },
  { value: "anomaly", label: "Anomaly", description: "Anomalous or unusual behavior" },
  { value: "custom", label: "Custom", description: "User-defined label type" },
];

function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ${diffHours % 24}h`;
}

function getLabelTypeBadgeVariant(type: LabelType): "default" | "secondary" | "destructive" {
  switch (type) {
    case "normal":
      return "default";
    case "anomaly":
      return "destructive";
    case "custom":
      return "secondary";
  }
}

export function LabelSelector({
  signalId,
  timeRange,
  onLabelCreated,
  existingTags = [],
  recentLabels = [],
}: LabelSelectorProps) {
  const [labelType, setLabelType] = useState<LabelType>("normal");
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [newTagName, setNewTagName] = useState("");
  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTagChange = useCallback((value: string) => {
    if (value === "__new__") {
      setIsCreatingNewTag(true);
      setSelectedTagId("");
    } else {
      setSelectedTagId(value);
      setIsCreatingNewTag(false);
      setNewTagName("");
    }
  }, []);

  const handleCreateTag = useCallback(() => {
    if (newTagName.trim()) {
      setIsCreatingNewTag(false);
    }
  }, [newTagName]);

  const handleCancelNewTag = useCallback(() => {
    setIsCreatingNewTag(false);
    setNewTagName("");
  }, []);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const labelData = {
        signal_id: signalId,
        start_time: timeRange.start.toISOString(),
        end_time: timeRange.end.toISOString(),
        label_type: labelType,
        tag_id: selectedTagId || null,
        notes: notes.trim() || null,
      };

      const response = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(labelData),
      });

      if (!response.ok) {
        throw new Error("Failed to create label");
      }

      const createdLabel = await response.json();
      onLabelCreated({
        ...createdLabel,
        start_time: new Date(createdLabel.start_time),
        end_time: new Date(createdLabel.end_time),
        created_at: new Date(createdLabel.created_at),
      });

      setNotes("");
      setSelectedTagId("");
      setNewTagName("");
    } catch (error) {
      console.error("Error creating label:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [signalId, timeRange, labelType, selectedTagId, notes, onLabelCreated]);

  const selectedTag = existingTags.find((t) => t.id === selectedTagId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Create Label
        </CardTitle>
        <CardDescription>
          Select a time range on the chart and assign a label
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-2xl border bg-muted/50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Selected Time Range</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Start</p>
              <p className="font-mono text-sm">{formatDateTime(timeRange.start)}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-px w-12 bg-border" />
              <Badge variant="outline">{formatDuration(timeRange.start, timeRange.end)}</Badge>
              <div className="h-px w-12 bg-border" />
            </div>
            <div className="space-y-1 text-right">
              <p className="text-xs text-muted-foreground">End</p>
              <p className="font-mono text-sm">{formatDateTime(timeRange.end)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Label Type</Label>
          <div className="grid gap-2">
            {LABEL_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setLabelType(option.value)}
                className={`flex items-center justify-between rounded-2xl border p-3 text-left transition-colors ${
                  labelType === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div>
                  <p className="font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
                <div
                  className={`h-4 w-4 rounded-full border-2 ${
                    labelType === option.value
                      ? "border-primary bg-primary"
                      : "border-muted-foreground"
                  }`}
                >
                  {labelType === option.value && (
                    <div className="h-full w-full rounded-full bg-white scale-50" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Tag</Label>
          {!isCreatingNewTag ? (
            <Select value={selectedTagId} onValueChange={handleTagChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tag (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No tag</SelectItem>
                {existingTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="__new__">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create new tag
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="New tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" onClick={handleCreateTag} disabled={!newTagName.trim()}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelNewTag}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {selectedTag && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="gap-1"
                style={{ borderColor: selectedTag.color, color: selectedTag.color }}
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: selectedTag.color }}
                />
                {selectedTag.name}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-auto p-1"
                onClick={() => setSelectedTagId("")}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="Add notes about this label..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Create Label
            </>
          )}
        </Button>

        {recentLabels.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Recent Labels
            </Label>
            <div className="space-y-2">
              {recentLabels.slice(0, 5).map((label) => (
                <div
                  key={label.id}
                  className="flex items-center justify-between rounded-xl border p-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={getLabelTypeBadgeVariant(label.label_type)}>
                      {label.label_type}
                    </Badge>
                    {label.tag_name && (
                      <Badge variant="outline" className="gap-1">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: label.tag_color }}
                        />
                        {label.tag_name}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(label.start_time)} - {formatDateTime(label.end_time)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
