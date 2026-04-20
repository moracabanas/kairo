"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Pencil,
  Trash2,
  Loader2,
  Calendar,
  Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Label {
  id: string;
  signal_id: string;
  start_time: string;
  end_time: string;
  label_type: "normal" | "anomaly" | "custom";
  tag_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  tag_name?: string;
  tag_color?: string;
  creator_email?: string;
}

interface LabelTag {
  id: string;
  name: string;
  color: string;
}

interface RawLabel {
  id: string;
  signal_id: string;
  start_time: string;
  end_time: string;
  label_type: "normal" | "anomaly" | "custom";
  tag_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  tag: { id: string; name: string; color: string } | null;
  creator: { id: string; email: string } | null;
}

interface LabelHistoryProps {
  signalId: string;
}

type SortOrder = "newest" | "oldest";

const PAGE_SIZE = 20;

export function LabelHistory({ signalId }: LabelHistoryProps) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [tags, setTags] = useState<LabelTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [deleteConfirmLabel, setDeleteConfirmLabel] = useState<Label | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchLabels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      let query = supabase
        .from("labels")
        .select(`
          *,
          tag:label_tags(id, name, color),
          creator:users(id, email)
        `)
        .eq("signal_id", signalId);

      if (typeFilter !== "all") {
        query = query.eq("label_type", typeFilter);
      }

      if (tagFilter !== "all") {
        query = query.eq("tag_id", tagFilter);
      }

      if (dateFrom) {
        query = query.gte("start_time", new Date(dateFrom).toISOString());
      }

      if (dateTo) {
        query = query.lte("end_time", new Date(dateTo + "T23:59:59").toISOString());
      }

      query = query.order("start_time", { ascending: sortOrder === "oldest" });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const formattedLabels: Label[] = (data || []).map((label: RawLabel) => ({
        ...label,
        tag_name: label.tag?.name,
        tag_color: label.tag?.color,
        creator_email: label.creator?.email,
      }));

      setLabels(formattedLabels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load labels");
    } finally {
      setLoading(false);
    }
  }, [signalId, typeFilter, tagFilter, dateFrom, dateTo, sortOrder]);

  const fetchTags = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: signalData } = await supabase
        .from("signals")
        .select("org_id")
        .eq("id", signalId)
        .single();

      if (!signalData?.org_id) return;

      const { data } = await supabase
        .from("label_tags")
        .select("id, name, color")
        .eq("org_id", signalData.org_id)
        .order("name");

      setTags(data || []);
    } catch (err) {
      console.error("Failed to load tags:", err);
    }
  }, [signalId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLabels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalId, typeFilter, tagFilter, dateFrom, dateTo, sortOrder]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalId]);

  const handleRefresh = () => {
    fetchLabels();
    fetchTags();
  };

  const toggleRowExpand = (labelId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(labelId)) {
      newExpanded.delete(labelId);
    } else {
      newExpanded.add(labelId);
    }
    setExpandedRows(newExpanded);
  };

  const handleEditLabel = async (label: Label) => {
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("labels")
        .update({
          start_time: label.start_time,
          end_time: label.end_time,
          label_type: label.label_type,
          tag_id: label.tag_id || null,
          notes: label.notes,
        })
        .eq("id", label.id);

      if (updateError) throw updateError;
      setEditingLabel(null);
      fetchLabels();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update label");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLabel = async (label: Label) => {
    setSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from("labels")
        .delete()
        .eq("id", label.id);

      if (deleteError) throw deleteError;
      setDeleteConfirmLabel(null);
      fetchLabels();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete label");
    } finally {
      setSaving(false);
    }
  };

  const filteredLabels = labels;
  const totalPages = Math.ceil(filteredLabels.length / PAGE_SIZE);
  const paginatedLabels = filteredLabels.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const formatTimeRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "normal":
        return "secondary";
      case "anomaly":
        return "destructive";
      case "custom":
        return "outline";
      default:
        return "default";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Label History</CardTitle>
            <CardDescription>View and manage signal labels</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="anomaly">Anomaly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px]"
              placeholder="From"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px]"
              placeholder="To"
            />
          </div>

          <Select
            value={sortOrder}
            onValueChange={(v: SortOrder) => setSortOrder(v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            {error}
          </div>
        )}

        {loading && labels.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-border" />
          </div>
        ) : labels.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p>No labels found for this signal</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Time Range</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLabels.map((label) => (
                  <>
                    <TableRow key={label.id}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => toggleRowExpand(label.id)}
                        >
                          {expandedRows.has(label.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatTimeRange(label.start_time, label.end_time)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTypeBadgeVariant(label.label_type)}>
                          {label.label_type.charAt(0).toUpperCase() +
                            label.label_type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {label.tag_name ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${label.tag_color}20`,
                              color: label.tag_color,
                            }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: label.tag_color }}
                            />
                            {label.tag_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{label.creator_email || "-"}</TableCell>
                      <TableCell>{formatDate(label.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditingLabel(label)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleteConfirmLabel(label)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(label.id) && (
                      <TableRow key={`${label.id}-expanded`}>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <div className="py-2 px-4">
                            <h4 className="text-sm font-medium mb-1">Notes</h4>
                            <p className="text-sm text-muted-foreground">
                              {label.notes || "No notes provided"}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
                  {Math.min(currentPage * PAGE_SIZE, filteredLabels.length)} of{" "}
                  {filteredLabels.length} labels
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
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
          </>
        )}
      </CardContent>

      <Dialog open={!!editingLabel} onOpenChange={() => setEditingLabel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Label</DialogTitle>
            <DialogDescription>
              Update label details for the selected time range.
            </DialogDescription>
          </DialogHeader>
          {editingLabel && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Time</label>
                  <Input
                    type="datetime-local"
                    value={editingLabel.start_time.slice(0, 16)}
                    onChange={(e) =>
                      setEditingLabel({
                        ...editingLabel,
                        start_time: new Date(e.target.value).toISOString(),
                      })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Time</label>
                  <Input
                    type="datetime-local"
                    value={editingLabel.end_time.slice(0, 16)}
                    onChange={(e) =>
                      setEditingLabel({
                        ...editingLabel,
                        end_time: new Date(e.target.value).toISOString(),
                      })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={editingLabel.label_type}
                  onValueChange={(v: "normal" | "anomaly" | "custom") =>
                    setEditingLabel({ ...editingLabel, label_type: v })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="anomaly">Anomaly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Tag</label>
                <Select
                  value={editingLabel.tag_id || "none"}
                  onValueChange={(v) =>
                    setEditingLabel({
                      ...editingLabel,
                      tag_id: v === "none" ? null : v,
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Tag</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  value={editingLabel.notes || ""}
                  onChange={(e) =>
                    setEditingLabel({ ...editingLabel, notes: e.target.value })
                  }
                  className="mt-1 w-full min-h-[100px] rounded-3xl border border-transparent bg-input/50 px-3 py-2 text-sm"
                  placeholder="Add notes..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLabel(null)}>
              Cancel
            </Button>
            <Button onClick={() => editingLabel && handleEditLabel(editingLabel)} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteConfirmLabel}
        onOpenChange={() => setDeleteConfirmLabel(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Label</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this label? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmLabel(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmLabel && handleDeleteLabel(deleteConfirmLabel)}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
