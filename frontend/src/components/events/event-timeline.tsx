"use client";

import { AnomalyEvent } from "@/lib/supabase";
import { EventCard } from "./event-card";
import { cn } from "@/lib/utils";

interface EventTimelineProps {
  events: AnomalyEvent[];
  selectedEventId?: string | null;
  onEventClick: (event: AnomalyEvent) => void;
}

export function EventTimeline({ events, selectedEventId, onEventClick }: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-muted-foreground">
          <p className="text-lg font-medium mb-1">No events found</p>
          <p className="text-sm">Events will appear here when anomalies are detected.</p>
        </div>
      </div>
    );
  }

  const groupedByDate = events.reduce<Record<string, AnomalyEvent[]>>((acc, event) => {
    const date = new Date(event.created_at).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {});

  return (
    <div className="relative">
      <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-8">
        {Object.entries(groupedByDate).map(([date, dateEvents]) => (
          <div key={date} className="relative">
            <div className="sticky top-4 z-10 mb-4">
              <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground ml-6">
                {date}
              </div>
            </div>
            <div className="space-y-4 pl-6">
              {dateEvents.map((event) => (
                <div key={event.id} className="relative">
                  <div
                    className={cn(
                      "absolute -left-6 top-6 w-3 h-3 rounded-full border-2 border-background bg-muted",
                      event.severity === "critical" && "bg-red-500",
                      event.severity === "warning" && "bg-yellow-500",
                      event.severity === "info" && "bg-blue-500"
                    )}
                  />
                  <EventCard
                    event={event}
                    onClick={() => onEventClick(event)}
                    isSelected={selectedEventId === event.id}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}