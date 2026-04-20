"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignalChart, SignalDataPoint } from "@/components/signals/signal-chart";
import { Loader2, Upload, Play, Download, TrendingUp } from "lucide-react";

type SamplePreset = "sine" | "random" | "stock";

interface PredictionResult {
  forecastData: SignalDataPoint[];
  forecastLower: number[];
  forecastUpper: number[];
  contextUsed: number;
  horizon: number;
  confidenceInterval: number;
}

const SAMPLE_PRESETS: { value: SamplePreset; label: string; description: string }[] = [
  { value: "sine", label: "Sine Wave", description: "Math.sin(i / 10) * 10" },
  { value: "random", label: "Random Walk", description: "Cumulative sum of random ±1" },
  { value: "stock", label: "Stock-like", description: "Random with drift and volatility" },
];

function generateSineWave(points: number = 100): SignalDataPoint[] {
  const data: SignalDataPoint[] = [];
  const now = Date.now();
  for (let i = 0; i < points; i++) {
    data.push({
      timestamp: now + i * 3600000,
      value: Math.sin(i / 10) * 10,
    });
  }
  return data;
}

function generateRandomWalk(points: number = 100): SignalDataPoint[] {
  const data: SignalDataPoint[] = [];
  let value = 0;
  const now = Date.now();
  for (let i = 0; i < points; i++) {
    value += Math.random() > 0.5 ? 1 : -1;
    data.push({
      timestamp: now + i * 3600000,
      value,
    });
  }
  return data;
}

function generateStockLike(points: number = 100): SignalDataPoint[] {
  const data: SignalDataPoint[] = [];
  let value = 100;
  const now = Date.now();
  for (let i = 0; i < points; i++) {
    const drift = 0.05;
    const volatility = 2;
    value += drift + (Math.random() - 0.5) * volatility;
    data.push({
      timestamp: now + i * 3600000,
      value,
    });
  }
  return data;
}

function generateMockForecast(inputData: SignalDataPoint[]): PredictionResult {
  const lastValue = inputData[inputData.length - 1]?.value ?? 0;
  const horizon = 24;
  const lastTimestamp = inputData[inputData.length - 1]?.timestamp ?? Date.now();

  const forecastData: SignalDataPoint[] = [];
  const forecastLower: number[] = [];
  const forecastUpper: number[] = [];

  for (let i = 1; i <= horizon; i++) {
    const forecastValue = lastValue + Math.sin(i / 5) * 3;
    forecastData.push({
      timestamp: lastTimestamp + i * 3600000,
      value: forecastValue,
    });
    forecastLower.push(forecastValue - 5 - Math.random() * 3);
    forecastUpper.push(forecastValue + 5 + Math.random() * 3);
  }

  return {
    forecastData,
    forecastLower,
    forecastUpper,
    contextUsed: inputData.length,
    horizon,
    confidenceInterval: 95,
  };
}

function parseJsonInput(jsonStr: string): SignalDataPoint[] | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.map((item, i) => {
        if (typeof item === "object" && item !== null) {
          const obj = item as Record<string, unknown>;
          const timestamp = obj.timestamp ? new Date(obj.timestamp as string).getTime() : Date.now() + i * 3600000;
          const value = typeof obj.value === "number" ? obj.value : 0;
          return { timestamp, value };
        }
        return { timestamp: Date.now() + i * 3600000, value: Number(item) || 0 };
      });
    }
    return null;
  } catch {
    return null;
  }
}

function convertToCsv(data: SignalDataPoint[], forecastData: SignalDataPoint[], forecastLower: number[], forecastUpper: number[]): string {
  const header = "timestamp,value,forecast,lower,upper\n";
  const rows = data.map((d) => `${new Date(d.timestamp).toISOString()},${d.value},,\n`).join("");
  const forecastRows = forecastData.map((d, i) => `${new Date(d.timestamp).toISOString()},,${d.value},${forecastLower[i]},${forecastUpper[i]}\n`).join("");
  return header + rows + forecastRows;
}

export default function PlaygroundPage() {
  const [dataSource, setDataSource] = useState<"preset" | "file" | "paste">("preset");
  const [selectedPreset, setSelectedPreset] = useState<SamplePreset>("sine");
  const [jsonInput, setJsonInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [inputData, setInputData] = useState<SignalDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);

  const previewData = useMemo(() => {
    if (inputData.length === 0) return [];
    return inputData.slice(0, 10);
  }, [inputData]);

  const handlePresetChange = (preset: SamplePreset) => {
    setSelectedPreset(preset);
    let data: SignalDataPoint[];
    switch (preset) {
      case "sine":
        data = generateSineWave();
        break;
      case "random":
        data = generateRandomWalk();
        break;
      case "stock":
        data = generateStockLike();
        break;
      default:
        data = generateSineWave();
    }
    setInputData(data);
    setResult(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (file.name.endsWith(".json")) {
        const parsed = parseJsonInput(content);
        if (parsed) {
          setInputData(parsed);
          setDataSource("file");
        }
      } else if (file.name.endsWith(".csv")) {
        const lines = content.trim().split("\n");
        const data: SignalDataPoint[] = [];
        for (let i = 1; i < lines.length; i++) {
          const [timestamp, value] = lines[i].split(",");
          if (timestamp && value) {
            data.push({
              timestamp: new Date(timestamp).getTime(),
              value: parseFloat(value),
            });
          }
        }
        if (data.length > 0) {
          setInputData(data);
          setDataSource("file");
        }
      }
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleParseJson = () => {
    const parsed = parseJsonInput(jsonInput);
    if (parsed && parsed.length > 0) {
      setInputData(parsed);
      setDataSource("paste");
      setResult(null);
    }
  };

  const handleRunPrediction = async () => {
    if (inputData.length === 0) return;

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const mockResult = generateMockForecast(inputData);
    setResult(mockResult);
    setIsLoading(false);
  };

  const handleDownloadCsv = () => {
    if (!result) return;

    const csv = convertToCsv(inputData, result.forecastData, result.forecastLower, result.forecastUpper);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "forecast.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Prediction Playground</h1>
        <p className="text-muted-foreground mt-1">
          Test forecasting with sample data or your own time series
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Data Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2">
              <Button
                variant={dataSource === "preset" ? "default" : "outline"}
                onClick={() => setDataSource("preset")}
              >
                Sample Data
              </Button>
              <Button
                variant={dataSource === "file" ? "default" : "outline"}
                onClick={() => setDataSource("file")}
              >
                Upload File
              </Button>
              <Button
                variant={dataSource === "paste" ? "default" : "outline"}
                onClick={() => setDataSource("paste")}
              >
                Paste JSON
              </Button>
            </div>

            {dataSource === "preset" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Sample</label>
                  <Select value={selectedPreset} onValueChange={(v) => handlePresetChange(v as SamplePreset)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SAMPLE_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {SAMPLE_PRESETS.find((p) => p.value === selectedPreset)?.description}
                  </p>
                </div>
              </div>
            )}

            {dataSource === "file" && (
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload a CSV or JSON file with your time series data
                  </p>
                  <Input
                    type="file"
                    accept=".csv,.json"
                    onChange={handleFileUpload}
                    className="max-w-xs mx-auto"
                  />
                </div>
                {uploadedFile && (
                  <p className="text-sm text-muted-foreground">
                    Uploaded: {uploadedFile.name} ({uploadedFile.size} bytes)
                  </p>
                )}
              </div>
            )}

            {dataSource === "paste" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Paste JSON Array</label>
                  <textarea
                    className="w-full h-32 p-3 border rounded-lg font-mono text-sm"
                    placeholder='[{"timestamp": "2024-01-01T00:00:00Z", "value": 100}, ...]'
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                  />
                  <Button onClick={handleParseJson} className="mt-2" variant="outline">
                    Parse JSON
                  </Button>
                </div>
              </div>
            )}

            {previewData.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Data Preview (first 10 rows)</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">
                          {new Date(row.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.value.toFixed(4)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-2">
                  Total rows: {inputData.length}
                </p>
              </div>
            )}

            <Button
              onClick={handleRunPrediction}
              disabled={inputData.length === 0 || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Prediction...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Prediction
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!result ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Run a prediction to see forecast results
                </p>
              </div>
            ) : (
              <>
                <div className="h-[300px]">
                  <SignalChart
                    signalId="playground"
                    data={inputData}
                    forecastData={result.forecastData}
                    forecastLower={result.forecastLower}
                    forecastUpper={result.forecastUpper}
                    timeRange="7d"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Context Used</p>
                    <p className="text-lg font-semibold">{result.contextUsed} points</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Forecast Horizon</p>
                    <p className="text-lg font-semibold">{result.horizon} hours</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg col-span-2">
                    <p className="text-xs text-muted-foreground">Confidence Interval</p>
                    <p className="text-lg font-semibold">{result.confidenceInterval}%</p>
                  </div>
                </div>

                <Button onClick={handleDownloadCsv} variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Download Forecast as CSV
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}