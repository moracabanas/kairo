"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Area,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

export interface SignalDataPoint {
  timestamp: number;
  value: number;
}

export type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d" | "custom";

interface SignalChartProps {
  signalId: string;
  data?: SignalDataPoint[];
  forecastData?: SignalDataPoint[];
  forecastLower?: number[];
  forecastUpper?: number[];
  isLoading?: boolean;
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

function formatTimestamp(timestamp: number, timeRange: TimeRange): string {
  const date = new Date(timestamp);
  switch (timeRange) {
    case "1h":
    case "6h":
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    case "24h":
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    case "7d":
    case "30d":
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    default:
      return date.toLocaleString();
  }
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(2);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: SignalDataPoint }>;
  label?: number;
  timeRange: TimeRange;
}

function CustomTooltip({ active, payload, label, timeRange }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="text-xs text-muted-foreground">
        {formatTimestamp(label as number, timeRange)}
      </p>
      <p className="text-sm font-semibold">{formatValue(payload[0].value)}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-9 w-16 rounded-3xl bg-muted animate-pulse"
          />
        ))}
      </div>
      <div className="h-[400px] w-full rounded-4xl bg-muted animate-pulse" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center rounded-4xl border border-dashed">
      <p className="text-muted-foreground">No data available</p>
      <p className="text-sm text-muted-foreground">
        Data will appear here once the signal starts receiving values
      </p>
    </div>
  );
}

export function SignalChart({
  signalId,
  data = [],
  forecastData = [],
  forecastLower,
  forecastUpper,
  isLoading = false,
  timeRange = "24h",
  onTimeRangeChange,
}: SignalChartProps) {
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
  const [zoomDomain, setZoomDomain] = useState<{ left: number; right: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const displayData = useMemo(() => {
    if (!zoomDomain || !data.length) return data;
    return data.filter(
      (d) => d.timestamp >= zoomDomain.left && d.timestamp <= zoomDomain.right
    );
  }, [data, zoomDomain]);

  const chartData = useMemo(() => {
    if (!forecastData?.length) return displayData.map((d) => ({ ...d }));
    const historicalMap = new Map(displayData.map((d) => [d.timestamp, d.value]));
    const forecastLowerMap = forecastLower ? new Map(forecastData.map((d, i) => [d.timestamp, forecastLower[i]])) : null;
    const forecastUpperMap = forecastUpper ? new Map(forecastData.map((d, i) => [d.timestamp, forecastUpper[i]])) : null;

    return forecastData.map((point) => ({
      timestamp: point.timestamp,
      value: point.value,
      forecast: point.value,
      forecastLower: forecastLowerMap?.get(point.timestamp),
      forecastUpper: forecastUpperMap?.get(point.timestamp),
      baseline: forecastLowerMap?.get(point.timestamp),
      historicalValue: historicalMap.get(point.timestamp),
    }));
  }, [displayData, forecastData, forecastLower, forecastUpper]);

  const yDomain = useMemo(() => {
    const allData = forecastData?.length ? [...displayData, ...forecastData] : displayData;
    if (!allData.length) return [0, 100];
    const values = allData.map((d) => d.value);
    if (forecastLower?.length && forecastUpper?.length) {
      values.push(...forecastLower, ...forecastUpper);
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1 || 10;
    return [min - padding, max + padding];
  }, [displayData, forecastData, forecastLower, forecastUpper]);

  const handleMouseDown = (e: unknown) => {
    const event = e as { activeLabel?: number | string };
    if (event.activeLabel !== undefined) {
      setRefAreaLeft(Number(event.activeLabel));
      setIsSelecting(true);
    }
  };

  const handleMouseMove = (e: unknown) => {
    const event = e as { activeLabel?: number | string };
    if (isSelecting && event.activeLabel !== undefined) {
      setRefAreaRight(Number(event.activeLabel));
    }
  };

  const handleMouseUp = () => {
    if (refAreaLeft && refAreaRight) {
      const left = Math.min(refAreaLeft, refAreaRight);
      const right = Math.max(refAreaLeft, refAreaRight);
      if (right - left > 1000) {
        setZoomDomain({ left, right });
      }
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setIsSelecting(false);
  };

  const handleZoomOut = () => {
    if (!zoomDomain || !data.length) return;
    const range = zoomDomain.right - zoomDomain.left;
    const center = (zoomDomain.left + zoomDomain.right) / 2;
    const newRange = range * 2;
    const newLeft = center - newRange / 2;
    const newRight = center + newRange / 2;
    setZoomDomain({
      left: Math.max(data[0].timestamp, newLeft),
      right: Math.min(data[data.length - 1].timestamp, newRight),
    });
  };

  const handleZoomIn = () => {
    if (!zoomDomain || !data.length) return;
    const range = zoomDomain.right - zoomDomain.left;
    const center = (zoomDomain.left + zoomDomain.right) / 2;
    const newRange = range / 2;
    setZoomDomain({
      left: center - newRange / 2,
      right: center + newRange / 2,
    });
  };

  const handleReset = () => {
    setZoomDomain(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Select
              value={timeRange}
              onValueChange={(value) => onTimeRangeChange?.(value as TimeRange)}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleZoomIn}
              disabled={!zoomDomain}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleZoomOut}
              disabled={!zoomDomain || !data.length}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleReset}
              disabled={!zoomDomain}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

          <div className="mt-6" data-signal-id={signalId}>
            {!data.length ? (
              <EmptyState />
            ) : (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={forecastData?.length ? chartData : displayData}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(ts) => formatTimestamp(ts, timeRange)}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                    type="number"
                    domain={zoomDomain ? [zoomDomain.left, zoomDomain.right] : ["auto", "auto"]}
                    scale="time"
                  />
                  <YAxis
                    tickFormatter={formatValue}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                    domain={yDomain}
                    width={60}
                  />
                  <Tooltip
                    content={<CustomTooltip timeRange={timeRange} />}
                    cursor={{ strokeDasharray: "5 5" }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(value) => (
                      <span className="text-xs text-muted-foreground">
                        {value === "value" ? "Historical" : value === "forecast" ? "Forecast" : value === "Confidence Band" ? "Confidence Band" : value}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#0ea5e9" }}
                    animationDuration={300}
                  />
                  {forecastData?.length && forecastLower && forecastUpper && (
                    <Area
                      type="monotone"
                      dataKey="forecastUpper"
                      baseLine={yDomain[0]}
                      name="Confidence Band"
                      stroke="none"
                      fill="#f97316"
                      fillOpacity={0.2}
                      animationDuration={300}
                    />
                  )}
                  {forecastData?.length && (
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={{ r: 4, fill: "#f97316" }}
                      animationDuration={300}
                    />
                  )}
                  {refAreaLeft && refAreaRight && (
                    <ReferenceArea
                      x1={refAreaLeft}
                      x2={refAreaRight}
                      strokeOpacity={0.3}
                      className="fill-primary/20"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {zoomDomain && (
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Zoomed view. Click reset to see full range.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
