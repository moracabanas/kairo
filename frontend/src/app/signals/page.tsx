"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, Loader2, MoreHorizontal, Eye, Edit, Trash2, Database, FileText, MessageSquare, File } from "lucide-react";
import { supabase, getUserOrgId } from "@/lib/supabase";

interface Signal {
  id: string;
  name: string;
  source_type: "database" | "mqtt" | "file" | "log";
  org_id: string;
  created_at: string;
  updated_at: string;
}

const SOURCE_TYPE_OPTIONS = [
  { value: "all", label: "All Sources" },
  { value: "database", label: "Database" },
  { value: "mqtt", label: "MQTT" },
  { value: "file", label: "File" },
  { value: "log", label: "Log" },
];

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

export default function SignalsPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setOrgId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

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
        setOrgId(userOrgId);

        const mockSignals: Signal[] = [
          { id: "1", name: "Production Sensor A", source_type: "database", org_id: userOrgId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "2", name: "Temperature Monitor", source_type: "mqtt", org_id: userOrgId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "3", name: "Sales Data Feed", source_type: "file", org_id: userOrgId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "4", name: "Application Logs", source_type: "log", org_id: userOrgId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "5", name: "Stock Prices", source_type: "database", org_id: userOrgId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "6", name: "Weather Data", source_type: "mqtt", org_id: userOrgId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "7", name: "User Events", source_type: "log", org_id: userOrgId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: "8", name: "Network Metrics", source_type: "file", org_id: userOrgId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        ];

        setSignals(mockSignals);
        setTotalPages(Math.ceil(mockSignals.length / pageSize));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load signals");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const filteredSignals = signals.filter((signal) => {
    const matchesSearch = signal.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = sourceFilter === "all" || signal.source_type === sourceFilter;
    return matchesSearch && matchesSource;
  });

  const paginatedSignals = filteredSignals.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleDelete = async (signalId: string) => {
    if (!confirm("Are you sure you want to delete this signal?")) return;
    try {
      setSignals(signals.filter((s) => s.id !== signalId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete signal");
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Signals</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage your data signals
          </p>
        </div>
        <Button onClick={() => router.push("/signals/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Signal
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search signals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSignals.map((signal) => {
                const Icon = SOURCE_ICONS[signal.source_type];
                const isHealthy = signal.id === "2" || signal.id === "4" || signal.id === "6" || signal.id === "8" ? false : true;
                return (
                  <TableRow key={signal.id}>
                    <TableCell className="font-medium">{signal.name}</TableCell>
                    <TableCell>
                      <Badge className={SOURCE_COLORS[signal.source_type]}>
                        <Icon className="mr-1 h-3 w-3" />
                        {signal.source_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(signal.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/signals/${signal.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/signals/${signal.id}?edit=true`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(signal.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredSignals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <p>No signals found</p>
                      <Button variant="outline" onClick={() => router.push("/signals/new")}>
                        Create your first signal
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
