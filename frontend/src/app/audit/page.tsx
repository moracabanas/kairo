"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Download, Filter, ChevronLeft, ChevronRight, FileJson, FileText } from "lucide-react";

interface AuditEntry {
  id: string;
  user_id: string | null;
  org_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  table_name: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AuditResponse {
  data: AuditEntry[];
  count: number;
}

const ITEMS_PER_PAGE = 20;

const ACTION_COLORS = {
  INSERT: "bg-green-500/10 text-green-500 border-green-500/20",
  UPDATE: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  DELETE: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({
    userId: "",
    action: "",
    tableName: "",
    startDate: "",
    endDate: "",
  });
  const filtersRef = useRef(filters);
  const pageRef = useRef(currentPage);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    pageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    let cancelled = false;
    const fetchAuditLogs = async () => {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: pageRef.current.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });

      const currentFilters = filtersRef.current;
      if (currentFilters.userId) params.append("user_id", currentFilters.userId);
      if (currentFilters.action) params.append("action", currentFilters.action);
      if (currentFilters.tableName) params.append("table_name", currentFilters.tableName);
      if (currentFilters.startDate) params.append("start_date", currentFilters.startDate);
      if (currentFilters.endDate) params.append("end_date", currentFilters.endDate);

      try {
        const res = await fetch(`/api/audit?${params}`);
        const json: AuditResponse = await res.json();
        if (!cancelled) {
          setEntries(json.data || []);
          setTotalCount(json.count || 0);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch audit logs:", error);
          setEntries([]);
          setTotalCount(0);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchAuditLogs();
    return () => {
      cancelled = true;
    };
  }, [currentPage, filters]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const exportToCSV = () => {
    const headers = [
      "ID",
      "User ID",
      "Org ID",
      "Action",
      "Table",
      "Old Values",
      "New Values",
      "IP Address",
      "User Agent",
      "Created At",
    ];
    const csvRows = [
      headers.join(","),
      ...entries.map((e) =>
        [
          e.id,
          e.user_id || "",
          e.org_id || "",
          e.action,
          e.table_name,
          JSON.stringify(e.old_values || {}),
          JSON.stringify(e.new_values || {}),
          e.ip_address || "",
          (e.user_agent || "").replace(/"/g, '""'),
          e.created_at,
        ].join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilters({ userId: "", action: "", tableName: "", startDate: "", endDate: "" });
    setCurrentPage(1);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">ISO 27001 compliant audit trail</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportToCSV}>
              <FileText className="mr-2 h-4 w-4" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToJSON}>
              <FileJson className="mr-2 h-4 w-4" />
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by User ID"
            value={filters.userId}
            onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
            className="w-48"
          />
          <Select
            value={filters.action}
            onValueChange={(value) => setFilters({ ...filters, action: value })}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INSERT">INSERT</SelectItem>
              <SelectItem value="UPDATE">UPDATE</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.tableName}
            onValueChange={(value) => setFilters({ ...filters, tableName: value })}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Table" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="organizations">organizations</SelectItem>
              <SelectItem value="users">users</SelectItem>
              <SelectItem value="signals">signals</SelectItem>
              <SelectItem value="signal_data">signal_data</SelectItem>
              <SelectItem value="auth.users">auth.users</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="w-40"
          />
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="w-40"
          />
          <Button variant="ghost" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Old Values</TableHead>
              <TableHead>New Values</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No audit entries found
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry, index) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-xs">
                    {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={ACTION_COLORS[entry.action]}
                    >
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {entry.table_name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.user_id || "system"}
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-48 truncate">
                    {entry.old_values ? JSON.stringify(entry.old_values) : "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-48 truncate">
                    {entry.new_values ? JSON.stringify(entry.new_values) : "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.ip_address || "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(entry.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
          {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount}{" "}
          entries
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
