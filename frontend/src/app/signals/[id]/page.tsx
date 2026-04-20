"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Database, FileText, MessageSquare, File, Edit, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SignalChart, SignalDataPoint } from "@/components/signals/signal-chart";

interface Signal {
  id: string;
  name: string;
  source_type: "database" | "mqtt" | "file" | "log";
  source_config: Record<string, string>;
  org_id: string;
  created_at: string;
  updated_at: string;
}

const SOURCE_ICONS = {
  database: Database,
  mqtt: MessageSquare,
  file: File,
  log: FileText,
};

const SOURCE_COLORS = {
  database: "bg-blue-100 text-blue-800 border-blue-200",
  mqtt: "bg-purple-100 text-purple-800 border-purple-200",
  file: "bg-green-100 text-green-800 border-green-200",
  log: "bg-orange-100 text-orange-800 border-orange-200",
};

const SOURCE_LABELS = {
  database: "Database",
  mqtt: "MQTT",
  file: "File",
  log: "Log",
};

export default function SignalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const signalId = params.id as string;

  const [signal, setSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHealthy] = useState(true);
  const [historicalData, setHistoricalData] = useState<SignalDataPoint[]>([]);
  const [forecastData, setForecastData] = useState<SignalDataPoint[]>([]);
  const [lowerBound, setLowerBound] = useState<number[]>([]);
  const [upperBound, setUpperBound] = useState<number[]>([]);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [contextUsed, setContextUsed] = useState(0);
  const [forecastLength, setForecastLength] = useState(24);
  const [confidence, setConfidence] = useState(95);

  useEffect(() => {
    const loadSignal = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push("/login");
          return;
        }

        const mockSignal: Signal = {
          id: signalId,
          name: "Production Sensor A",
          source_type: "database",
          source_config: {
            host: "db.example.com",
            port: "5432",
            database: "production",
            query: "SELECT * FROM sensor_data",
            username: "readonly_user",
          },
          org_id: "demo-org",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setSignal(mockSignal);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load signal");
      } finally {
        setLoading(false);
      }
    };
    loadSignal();
  }, [signalId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (error || !signal) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error || "Signal not found"}
        </div>
        <Button variant="ghost" onClick={() => router.push("/signals")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Signals
        </Button>
      </div>
    );
  }

  const Icon = SOURCE_ICONS[signal.source_type];

  const runPrediction = async () => {
    setIsLoadingPredictions(true);
    setPredictionError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setPredictionError("Not authenticated");
        return;
      }
      const token = session.access_token || "";

      const response = await fetch("/api/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          signal_id: signalId,
          context_length: 512,
          forecast_length: 24,
          frequency: 3600,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Prediction failed");
      }

      const result = await response.json();

      const now = Date.now();
      const histResponse = await supabase
        .from("signal_data")
        .select("timestamp, value")
        .eq("signal_id", signalId)
        .order("timestamp", { ascending: false })
        .limit(100);

      if (histResponse.data && histResponse.data.length > 0) {
        const hist = histResponse.data
          .map(d => ({ timestamp: new Date(d.timestamp).getTime(), value: d.value }))
          .reverse();
        setHistoricalData(hist);
      } else {
        const mockHist: SignalDataPoint[] = [];
        for (let i = 0; i < 50; i++) {
          mockHist.push({
            timestamp: now - (50 - i) * 3600000,
            value: Math.sin(i / 5) * 10 + Math.random() * 2,
          });
        }
        setHistoricalData(mockHist);
      }

      const forecast: SignalDataPoint[] = result.forecast.map((v: number, i: number) => ({
        timestamp: now + (i + 1) * 3600000,
        value: v,
      }));
      setForecastData(forecast);
      setLowerBound(result.lower_bound);
      setUpperBound(result.upper_bound);
      setContextUsed(result.context_used);
      setForecastLength(result.forecast_length);
      setConfidence(Math.round(result.confidence * 100));
    } catch (err) {
      setPredictionError(err instanceof Error ? err.message : "Failed to run prediction");
      const now = Date.now();
      const mockHist: SignalDataPoint[] = [];
      for (let i = 0; i < 50; i++) {
        mockHist.push({
          timestamp: now - (50 - i) * 3600000,
          value: Math.sin(i / 5) * 10 + Math.random() * 2,
        });
      }
      setHistoricalData(mockHist);
      const mockForecast: SignalDataPoint[] = [];
      for (let i = 0; i < 24; i++) {
        mockForecast.push({
          timestamp: now + (i + 1) * 3600000,
          value: mockHist[mockHist.length - 1].value + Math.sin(i / 5) * 3,
        });
      }
      setForecastData(mockForecast);
      setLowerBound(mockForecast.map((_, i) => mockForecast[i].value - 5));
      setUpperBound(mockForecast.map((_, i) => mockForecast[i].value + 5));
      setContextUsed(50);
      setForecastLength(24);
      setConfidence(95);
    } finally {
      setIsLoadingPredictions(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <Button variant="ghost" onClick={() => router.push("/signals")} className="mb-4 pl-0">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Signals
      </Button>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{signal.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge className={SOURCE_COLORS[signal.source_type]}>
                <Icon className="mr-1 h-3 w-3" />
                {SOURCE_LABELS[signal.source_type]}
              </Badge>
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    isHealthy ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span className="text-sm text-muted-foreground">
                  {isHealthy ? "Healthy" : "Error"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <Button onClick={() => router.push(`/signals/${signal.id}?edit=true`)}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="labels">Labels</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Signal source configuration details</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {Object.entries(signal.source_config).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <dt className="text-sm text-muted-foreground capitalize">
                        {key.replace(/_/g, " ")}
                      </dt>
                      <dd className="text-sm font-medium">
                        {key === "password" ? "••••••••" : value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
                <CardDescription>Signal metadata</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Signal ID</dt>
                    <dd className="text-sm font-medium font-mono">{signal.id}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Organization ID</dt>
                    <dd className="text-sm font-medium font-mono">{signal.org_id}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Created</dt>
                    <dd className="text-sm font-medium">
                      {new Date(signal.created_at).toLocaleDateString()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Last Updated</dt>
                    <dd className="text-sm font-medium">
                      {new Date(signal.updated_at).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle>Signal Data</CardTitle>
              <CardDescription>Recent data points from this signal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <p>Data visualization coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions">
          <Card>
            <CardHeader>
              <CardTitle>Predictions</CardTitle>
              <CardDescription>ML predictions based on signal data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingPredictions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-border" />
                </div>
              ) : predictionError ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                  {predictionError}
                </div>
              ) : forecastData.length > 0 ? (
                <>
                  <div className="h-[400px]">
                    <SignalChart
                      signalId={signalId}
                      data={historicalData}
                      forecastData={forecastData}
                      forecastLower={lowerBound}
                      forecastUpper={upperBound}
                      timeRange="7d"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Context Used</p>
                      <p className="text-lg font-semibold">{contextUsed} points</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Forecast Horizon</p>
                      <p className="text-lg font-semibold">{forecastLength} hours</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Confidence</p>
                      <p className="text-lg font-semibold">{confidence}%</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No predictions available</p>
                  <Button onClick={runPrediction} disabled={isLoadingPredictions}>
                    <Play className="mr-2 h-4 w-4" />
                    Run Prediction
                  </Button>
                </div>
              )}
              {forecastData.length === 0 && !isLoadingPredictions && (
                <Button onClick={runPrediction} disabled={isLoadingPredictions} className="w-full">
                  <Play className="mr-2 h-4 w-4" />
                  Generate Predictions
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labels">
          <Card>
            <CardHeader>
              <CardTitle>Labels</CardTitle>
              <CardDescription>Manage signal labels and annotations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <p>Label management coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
