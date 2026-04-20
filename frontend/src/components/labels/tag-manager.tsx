"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Pencil, Trash2, Tag } from "lucide-react";
import {
  LabelTag,
  listLabelTags,
  createLabelTag,
  updateLabelTag,
  deleteLabelTag,
  checkLabelTagUsage,
} from "@/lib/supabase";

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
  "#6b7280",
];

interface TagManagerProps {
  orgId: string;
  onTagChange?: () => void;
}

interface TagFormData {
  name: string;
  color: string;
  description: string;
}

export function TagManager({ orgId, onTagChange }: TagManagerProps) {
  const [tags, setTags] = useState<LabelTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<LabelTag | null>(null);
  const [formData, setFormData] = useState<TagFormData>({
    name: "",
    color: "#6b7280",
    description: "",
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteConfirmTag, setDeleteConfirmTag] = useState<LabelTag | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteUsageWarning, setDeleteUsageWarning] = useState<string | null>(null);

  useEffect(() => {
    loadTags();
  }, [orgId]);

  async function loadTags() {
    try {
      setLoading(true);
      setError(null);
      const data = await listLabelTags(orgId);
      setTags(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tags");
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingTag(null);
    setFormData({ name: "", color: "#6b7280", description: "" });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(tag: LabelTag) {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color,
      description: tag.description || "",
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Tag name is required");
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      if (editingTag) {
        await updateLabelTag(editingTag.id, formData.name.trim(), formData.color, formData.description.trim() || undefined);
      } else {
        await createLabelTag(orgId, formData.name.trim(), formData.color, formData.description.trim() || undefined);
      }
      await loadTags();
      setDialogOpen(false);
      onTagChange?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save tag");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeleteClick(tag: LabelTag) {
    setDeleteConfirmTag(tag);
    setDeleteError(null);
    setDeleteUsageWarning(null);

    try {
      const usageCount = await checkLabelTagUsage(tag.id);
      if (usageCount > 0) {
        setDeleteUsageWarning(`This tag is used by ${usageCount} label(s). Deleting it will remove the tag association from those labels.`);
      }
    } catch {
    }
  }

  async function confirmDelete() {
    if (!deleteConfirmTag) return;

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      await deleteLabelTag(deleteConfirmTag.id);
      await loadTags();
      setDeleteConfirmTag(null);
      onTagChange?.();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete tag");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Label Tags</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage tags to categorize your signal labels
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTag ? "Edit Tag" : "Create New Tag"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                  {formError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="tag-name">Name</Label>
                <Input
                  id="tag-name"
                  placeholder="e.g., Maintenance, Anomaly, Normal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        formData.color === color ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#000000"
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag-description">Description (optional)</Label>
                <Textarea
                  id="tag-description"
                  placeholder="Describe when this tag should be used..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingTag ? "Save Changes" : "Create Tag"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      {tags.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No tags yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first tag to start categorizing your signal labels
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create Tag
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tags.map((tag) => (
            <Card key={tag.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <div>
                      <div className="font-medium">{tag.name}</div>
                      {tag.description && (
                        <div className="text-sm text-muted-foreground">
                          {tag.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(tag)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteClick(tag)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={deleteConfirmTag !== null}
        onOpenChange={(open) => !open && setDeleteConfirmTag(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {deleteUsageWarning && (
              <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
                {deleteUsageWarning}
              </div>
            )}
            <p className="text-muted-foreground">
              Are you sure you want to delete the tag{" "}
              <strong>{deleteConfirmTag?.name}</strong>? This action cannot be undone.
            </p>
            {deleteError && (
              <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmTag(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Tag"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
