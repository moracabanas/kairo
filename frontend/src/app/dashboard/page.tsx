"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, TrendingUp, Database, Clock, CheckCircle } from "lucide-react";
import { AnomalyEvent, EventSeverity } from "@/lib/supabase";

interface EventStats {
  critical: number;
  warning: number;
  info: number;
  unacknowledged: number;
}

interface RecentSignal {
  id: string;
  name: string;
  source_type: string;
  updated_at: string;
}

interface RecentJob {
  id: string;
  model_type: string;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [eventStats, setEventStats] = useState<EventStats>({ critical: 0, warning: 0, info: 0, unacknowledged: 0 });
  const [recentEvents, setRecentEvents] = useState<AnomalyEvent[]>([]);
  const [recentSignals, setRecentSignals] = useState<RecentSignal[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);

  useEffect(() => {
    const checkUser = async () => {
      const supabase = getSupabaseClient();
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      if (!sessionUser) {
        router.push("/login");
        return;
      }
      setUser(sessionUser);

      const { data: userData } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", sessionUser.id)
        .single();

      if (!userData?.org_id) {
        router.push("/onboarding");
        return;
      }
      setOrgId(userData.org_id);

      await Promise.all([
        loadEventStats(userData.org_id),
        loadRecentSignals(),
        loadRecentJobs(userData.org_id),
      ]);

      setLoading(false);
    };
    checkUser();
  }, [router]);

  const loadEventStats = async (orgId: string) => {
    const supabase = getSupabaseClient();
    try {
      const { data: events, error } = await supabase
        .from("events")
        .select("severity, acknowledged")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const stats: EventStats = { critical: 0, warning: 0, info: 0, unacknowledged: 0 };
      const recent = (events || []).slice(0, 5) as AnomalyEvent[];

      events?.forEach(e => {
        if (e.severity === "critical") stats.critical++;
        else if (e.severity === "warning") stats.warning++;
        else if (e.severity === "info") stats.info++;
        if (!e.acknowledged) stats.unacknowledged++;
      });

      setEventStats(stats);
      setRecentEvents(recent);
    } catch (err) {
      console.error("Failed to load events:", err);
    }
  };

  const loadRecentSignals = async () => {
    const mockSignals: RecentSignal[] = [
      { id: "1", name: "Production Sensor A", source_type: "database", updated_at: new Date().toISOString() },
      { id: "2", name: "Temperature Monitor", source_type: "mqtt", updated_at: new Date(Date.now() - 3600000).toISOString() },
      { id: "3", name: "Sales Data Feed", source_type: "file", updated_at: new Date(Date.now() - 7200000).toISOString() },
    ];
    setRecentSignals(mockSignals);
  };

  const loadRecentJobs = async (orgId: string) => {
    const supabase = getSupabaseClient();
    try {
      const { data: jobs, error } = await supabase
        .from("training_jobs")
        .select("id, model_type, status, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentJobs(jobs || []);
    } catch (err) {
      console.error("Failed to load jobs:", err);
    }
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800 border-green-200";
      case "failed": return "bg-red-100 text-red-800 border-red-200";
      case "running": return "bg-blue-100 text-blue-800 border-blue-200";
      case "queued":
      case "scheduled": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
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
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              {user?.email ? `Welcome back, ${user.email.split("@")[0]}` : "Welcome to Kairo"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/events")}>
              <AlertTriangle className="mr-2 h-4 w-4" />
              Events
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical Events</p>
                  <p className="text-3xl font-bold text-red-600">{eventStats.critical}</p>
                </div>
                <AlertTriangle className="h-10 w-10 text-red-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Warning Events</p>
                  <p className="text-3xl font-bold text-yellow-600">{eventStats.warning}</p>
                </div>
                <AlertTriangle className="h-10 w-10 text-yellow-200" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                  <p className="text-3xl font-bold">{eventStats.critical + eventStats.warning + eventStats.info}</p>
                </div>
                <TrendingUp className="h-10 w-10 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Signals</p>
                  <p className="text-3xl font-bold">{recentSignals.length}</p>
                </div>
                <Database className="h-10 w-10 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Recent Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentEvents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No recent events</p>
              ) : (
                <div className="space-y-3">
                  {recentEvents.map(event => (
                    <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={
                          event.severity === "critical" ? "bg-red-100 text-red-800 border-red-200" :
                          event.severity === "warning" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                          "bg-blue-100 text-blue-800 border-blue-200"
                        }>
                          {event.severity}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{event.event_type.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      {event.acknowledged && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Button variant="ghost" className="w-full mt-4" onClick={() => router.push("/events")}>
                View all events
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Recent Signals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentSignals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No signals found</p>
              ) : (
                <div className="space-y-3">
                  {recentSignals.map(signal => (
                    <div key={signal.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <Database className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{signal.name}</p>
                          <p className="text-xs text-muted-foreground">{signal.source_type}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{new Date(signal.updated_at).toLocaleTimeString()}</p>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="ghost" className="w-full mt-4" onClick={() => router.push("/signals")}>
                View all signals
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Training Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No recent training jobs</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentJobs.map(job => (
                    <div key={job.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className={getJobStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{job.model_type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(job.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="ghost" className="w-full mt-4" onClick={() => router.push("/training")}>
                View training page
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}