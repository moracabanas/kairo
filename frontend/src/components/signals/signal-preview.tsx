"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  FileUp,
  FileText,
  Loader2,
  X,
  Upload,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"

interface ParsedRow {
  timestamp: string
  value: number | string
  [key: string]: unknown
}

interface FilePreview {
  name: string
  size: number
  rowCount: number
  rows: ParsedRow[]
  timestampColumn: string
  valueColumn: string
  timestampFormat: string
  valueType: "number" | "string"
  missingValues: number
}

interface SignalPreviewProps {
  onImport?: (file: File, preview: FilePreview) => void
  onCancel?: () => void
}

const PREVIEW_ROWS = 100
const SUPPORTED_FORMATS = ["CSV", "JSON"]

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function detectTimestampFormat(value: string): string {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
  const dateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/
  const unixTimestampRegex = /^\d{10,13}$/

  if (iso8601Regex.test(value) || dateTimeRegex.test(value)) {
    return "ISO 8601"
  }
  if (unixTimestampRegex.test(value)) {
    return value.length === 10 ? "Unix timestamp (s)" : "Unix timestamp (ms)"
  }
  return "Unknown"
}

function detectValueType(values: (number | string)[]): "number" | "string" {
  const numericCount = values.filter((v) => typeof v === "number" || !isNaN(Number(v))).length
  return numericCount / values.length > 0.8 ? "number" : "string"
}

async function parseFile(file: File): Promise<FilePreview> {
  const text = await file.text()
  const extension = file.name.split(".").pop()?.toLowerCase()

  let rows: ParsedRow[] = []
  let timestampColumn = ""
  let valueColumn = ""

  if (extension === "json") {
    const json = JSON.parse(text)
    const dataArray = Array.isArray(json) ? json : json.data || []
    rows = dataArray.slice(0, PREVIEW_ROWS + 1).map((row: Record<string, unknown>) => {
      const newRow: ParsedRow = { timestamp: "", value: "" }
      Object.entries(row).forEach(([key, value]) => {
        const lowerKey = key.toLowerCase()
        if (lowerKey.includes("time") || lowerKey.includes("date")) {
          newRow.timestamp = String(value)
        } else if (!timestampColumn) {
          newRow.value = value as string | number
        }
      })
      if (!newRow.timestamp && Object.keys(row).length > 0) {
        const keys = Object.keys(row)
        timestampColumn = keys[0]
        valueColumn = keys[1] || keys[0]
        newRow.timestamp = String(row[timestampColumn])
        newRow.value = row[valueColumn] as string | number
      }
      return newRow
    })
  } else {
    const lines = text.split("\n").filter((line) => line.trim())
    if (lines.length === 0) return {
      name: file.name,
      size: file.size,
      rowCount: 0,
      rows: [],
      timestampColumn: "",
      valueColumn: "",
      timestampFormat: "Unknown",
      valueType: "string",
      missingValues: 0,
    }

    const headerLine = lines[0]
    const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""))

    const timestampIdx = headers.findIndex((h) =>
      h.toLowerCase().includes("time") || h.toLowerCase().includes("date")
    )
    const valueIdx = timestampIdx >= 0
      ? headers.findIndex((_, i) => i !== timestampIdx)
      : 1

    timestampColumn = timestampIdx >= 0 ? headers[timestampIdx] : headers[0]
    valueColumn = headers[valueIdx] || headers[0]

    rows = lines.slice(1, PREVIEW_ROWS + 1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
      const row: ParsedRow = { timestamp: "", value: "" }
      row.timestamp = values[timestampIdx] || ""
      row.value = values[valueIdx] || ""
      return row
    })
  }

  const allValues = rows.map((r) => r.value)
  const missingValues = rows.filter((r) => r.timestamp === "" || r.value === "").length
  const timestampFormat = rows.length > 0 ? detectTimestampFormat(rows[0].timestamp) : "Unknown"
  const valueType = detectValueType(allValues)

  return {
    name: file.name,
    size: file.size,
    rowCount: extension === "json"
      ? (JSON.parse(text).data?.length || JSON.parse(text).length || 0)
      : text.split("\n").filter((l) => l.trim()).length - 1,
    rows,
    timestampColumn,
    valueColumn,
    timestampFormat,
    valueType,
    missingValues,
  }
}

export function SignalPreview({ onImport, onCancel }: SignalPreviewProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setError(null)

    const droppedFile = e.dataTransfer.files[0]
    if (!droppedFile) return

    const extension = droppedFile.name.split(".").pop()?.toLowerCase()
    if (extension !== "csv" && extension !== "json") {
      setError("Unsupported file format. Please upload a CSV or JSON file.")
      return
    }

    setFile(droppedFile)
    try {
      const previewData = await parseFile(droppedFile)
      setPreview(previewData)
    } catch {
      setError("Failed to parse file. Please check the file format.")
      setFile(null)
      setPreview(null)
    }
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const extension = selectedFile.name.split(".").pop()?.toLowerCase()
    if (extension !== "csv" && extension !== "json") {
      setError("Unsupported file format. Please upload a CSV or JSON file.")
      return
    }

    setFile(selectedFile)
    try {
      const previewData = await parseFile(selectedFile)
      setPreview(previewData)
    } catch {
      setError("Failed to parse file. Please check the file format.")
      setFile(null)
      setPreview(null)
    }
  }, [])

  const handleImport = useCallback(() => {
    if (!file || !preview) return
    setIsUploading(true)
    setUploadProgress(0)

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval)
          return prev
        }
        return prev + 10
      })
    }, 200)

    setTimeout(() => {
      clearInterval(interval)
      setUploadProgress(100)
      onImport?.(file, preview)
    }, 2000)
  }, [file, preview, onImport])

  const handleCancel = useCallback(() => {
    setFile(null)
    setPreview(null)
    setError(null)
    setUploadProgress(0)
    onCancel?.()
  }, [onCancel])

  if (isUploading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="size-12 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Importing signal data...</p>
          <div className="mt-4 h-2 w-48 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{uploadProgress}%</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="size-5" />
            Upload Signal Data
          </CardTitle>
          <CardDescription>
            Drag and drop a CSV or JSON file to preview your signal data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className={`relative rounded-4xl border-2 border-dashed p-8 transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileSelect}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <div className="flex flex-col items-center justify-center text-center">
              <FileText className="size-12 text-muted-foreground" />
              <p className="mt-4 text-sm font-medium">
                {isDragging ? "Drop file here" : "Drag and drop or click to browse"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Supported formats: {SUPPORTED_FORMATS.join(", ")}
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-3xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {error}
            </div>
          )}

          {file && preview && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-3xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">File Name</p>
                  <p className="mt-1 truncate font-medium">{preview.name}</p>
                </div>
                <div className="rounded-3xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">File Size</p>
                  <p className="mt-1 font-medium">{formatBytes(preview.size)}</p>
                </div>
                <div className="rounded-3xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                  <p className="mt-1 font-medium">{preview.rowCount.toLocaleString()}</p>
                </div>
                <div className="rounded-3xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Missing Values</p>
                  <p className="mt-1 font-medium">{preview.missingValues}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-3xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Timestamp Column</p>
                  <p className="mt-1 font-medium">{preview.timestampColumn}</p>
                </div>
                <div className="rounded-3xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Value Column</p>
                  <p className="mt-1 font-medium">{preview.valueColumn}</p>
                </div>
                <div className="rounded-3xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Timestamp Format</p>
                  <p className="mt-1 font-medium">{preview.timestampFormat}</p>
                </div>
                <div className="rounded-3xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Value Type</p>
                  <p className="mt-1 font-medium capitalize">{preview.valueType}</p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Data Preview</p>
                  <p className="text-xs text-muted-foreground">
                    Showing {preview.rows.length} of {preview.rowCount.toLocaleString()} rows
                  </p>
                </div>
                <div className="rounded-4xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-muted-foreground">
                            {row.timestamp || "-"}
                          </TableCell>
                          <TableCell>
                            {row.value !== "" ? String(row.value) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {preview.rowCount > PREVIEW_ROWS && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Preview limited to first {PREVIEW_ROWS} rows
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 rounded-3xl bg-green-500/10 p-3 text-sm text-green-600">
                <CheckCircle2 className="size-4" />
                File parsed successfully. Review the preview above and click Import to continue.
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="flex-1"
                >
                  <X className="size-4" />
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  className="flex-1"
                >
                  <Upload className="size-4" />
                  Import
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
