"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Info, Signal } from "lucide-react";
import { AnomalyEvent, EventSeverity } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: AnomalyEvent;
  onClick: () => void;
  isSelected?: boolean;
}

const SEVERITY_CONFIG: Record<EventSeverity, {
  label: string;
  icon: typeof AlertCircle;
  variant: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
  badgeClass: string;
}> = {
  critical: {
    label: "Critical",
    icon: AlertCircle,
    variant: "destructive",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    variant: "secondary",
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  info: {
    label: "Info",
    icon: Info,
    variant: "outline",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
  },
};

export function EventCard({ event, onClick, isSelected }: EventCardProps) {
  const severityConfig = SEVERITY_CONFIG[event.severity];
  const SeverityIcon = severityConfig.icon;

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={severityConfig.variant} className={severityConfig.badgeClass}>
                <SeverityIcon className="mr-1 h-3 w-3" />
                {severityConfig.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(event.created_at)}
              </span>
            </div>

            <h3 className="font-medium text-sm mb-1 truncate">
              {event.event_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </h3>

            {event.signal_ids.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Signal className="h-3 w-3" />
                <span>{event.signal_ids.length} signal{event.signal_ids.length !== 1 ? "s" : ""} involved</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}