"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { EventTimeline } from "@/components/events/event-timeline";
import { ArrowLeft, Loader2, AlertCircle, AlertTriangle, Info, Signal, Clock } from "lucide-react";
import { supabase, getUserOrgId, AnomalyEvent, EventSeverity } from "@/lib/supabase";

const SEVERITY_FILTER_OPTIONS = [
  { value: "all", label: "All Severities" },
  { value: "critical", label: "Critical Only" },
  { value: "warning", label: "Warnings Only" },
  { value: "info", label: "Info Only" },
];

const MOCK_EVENTS: AnomalyEvent[] = [
  {
    id: "1",
    org_id: "1",
    job_id: "job-1",
    signal_ids: ["sig-1", "sig-2"],
    event_type: "anomaly_detected",
    severity: "critical",
    event_data: { score: 0.95, threshold: 0.7, metric: "cpu_usage" },
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_by: null,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: "2",
    org_id: "1",
    job_id: "job-2",
    signal_ids: ["sig-3"],
    event_type: "pattern_changed",
    severity: "warning",
    event_data: { pattern: "daily_cycle", confidence: 0.6 },
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_by: null,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "3",
    org_id: "1",
    job_id: null,
    signal_ids: ["sig-1", "sig-3", "sig-4"],
    event_type: "drift_detected",
    severity: "warning",
    event_data: { drift_score: 0.75, features: ["temp", "pressure"] },
    acknowledged: true,
    acknowledged_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    acknowledged_by: "user-1",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "4",
    org_id: "1",
    job_id: "job-1",
    signal_ids: ["sig-2"],
    event_type: "model_updated",
    severity: "info",
    event_data: { model_version: "v2.1", accuracy: 0.92 },
    acknowledged: true,
    acknowledged_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    acknowledged_by: "user-1",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "5",
    org_id: "1",
    job_id: "job-3",
    signal_ids: ["sig-5"],
    event_type: "anomaly_detected",
    severity: "critical",
    event_data: { score: 0.98, threshold: 0.7, metric: "error_rate" },
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_by: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "6",
    org_id: "1",
    job_id: null,
    signal_ids: ["sig-1"],
    event_type: "signal_quality_low",
    severity: "warning",
    event_data: { quality_score: 0.35, min_required: 0.6 },
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_by: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: "7",
    org_id: "1",
    job_id: "job-2",
    signal_ids: ["sig-3", "sig-4"],
    event_type: "baseline_recalculated",
    severity: "info",
    event_data: { window_size: 1000, samples: 50000 },
    acknowledged: true,
    acknowledged_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    acknowledged_by: "user-1",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
];

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<AnomalyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<AnomalyEvent | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push("/login");
          return;
        }

        const userOrgId = await getUserOrgId(session.user.id);
        if (!userOrgId) {
          setError("No organization found for user");
          setLoading(false);
          return;
        }

        setEvents(MOCK_EVENTS);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const filteredEvents = events
    .filter((event) => {
      if (severityFilter === "all") return true;
      return event.severity === severityFilter;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const eventCounts = {
    all: events.length,
    critical: events.filter((e) => e.severity === "critical").length,
    warning: events.filter((e) => e.severity === "warning").length,
    info: events.filter((e) => e.severity === "info").length,
  };

  const getSeverityIcon = (severity: EventSeverity) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-5 w-5" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5" />;
      case "info":
        return <Info className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mb-4 pl-0">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Event Timeline</h1>
            <p className="text-muted-foreground mt-1">
              Monitor anomalies and system events across your signals
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-muted p-2">
                <Signal className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{eventCounts.all}</p>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{eventCounts.critical}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-100 p-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{eventCounts.warning}</p>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <Info className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{eventCounts.info}</p>
                <p className="text-xs text-muted-foreground">Info</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filter Events</CardTitle>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-6">
          <EventTimeline
            events={filteredEvents}
            selectedEventId={selectedEvent?.id}
            onEventClick={setSelectedEvent}
          />
        </CardContent>
      </Card>

      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getSeverityIcon(selectedEvent.severity)}
                  <span className="capitalize">
                    {selectedEvent.event_type.replace(/_/g, " ")}
                  </span>
                </DialogTitle>
                <DialogDescription>
                  Event ID: {selectedEvent.id}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      selectedEvent.severity === "critical"
                        ? "destructive"
                        : selectedEvent.severity === "warning"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {selectedEvent.severity}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {new Date(selectedEvent.created_at).toLocaleString()}
                  </span>
                </div>

                {selectedEvent.signal_ids.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Signal className="h-4 w-4" />
                      Signals Involved ({selectedEvent.signal_ids.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedEvent.signal_ids.map((sigId) => (
                        <Badge key={sigId} variant="outline">
                          {sigId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEvent.job_id && (
                  <div>
                    <p className="text-sm font-medium mb-1">Associated Job</p>
                    <p className="text-sm text-muted-foreground">{selectedEvent.job_id}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium mb-2">Event Data</p>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto">
                    {JSON.stringify(selectedEvent.event_data, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
