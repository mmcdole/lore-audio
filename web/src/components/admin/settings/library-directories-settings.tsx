"use client";

import React from "react";
import { Edit3, Plus, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DirectoryEditorDialog } from "@/components/admin/settings/directory-editor-dialog";

interface LibraryDirectory {
  id: string;
  path: string;
  name: string;
  enabled: boolean;
  created_at?: string;
  last_scanned_at?: string;
  book_count?: number;
}

export function LibraryDirectorySettings() {
  const [directories, setDirectories] = React.useState<LibraryDirectory[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">("create");
  const [activeDirectory, setActiveDirectory] = React.useState<LibraryDirectory | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const loadDirectories = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/library-paths");
      if (!res.ok) throw new Error("Failed to load library directories");
      const payload = await res.json();
      setDirectories(payload.data ?? []);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "Failed to load directories");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDirectories();
  }, [loadDirectories]);

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (!saving) {
        setDialogOpen(false);
        setActiveDirectory(null);
        setActionError(null);
      }
      return;
    }
    setDialogOpen(true);
  };

  const startCreate = () => {
    setActiveDirectory(null);
    setDialogMode("create");
    setActionError(null);
    setDialogOpen(true);
  };

  const startEdit = (entry: LibraryDirectory) => {
    setActiveDirectory(entry);
    setDialogMode("edit");
    setActionError(null);
    setDialogOpen(true);
  };

  const createDirectory = async (path: string) => {
    const name = deriveName(path);
    const res = await fetch("/api/v1/admin/library-paths", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, path })
    });
    if (!res.ok) throw new Error("Failed to create library directory");
  };

  const updateDirectoryPath = async (id: string, path: string) => {
    const res = await fetch(`/api/v1/admin/library-paths/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path })
    });
    if (!res.ok) throw new Error("Failed to update library directory");
  };

  const deleteDirectory = async (id: string) => {
    if (!confirm("Remove this library directory?")) return;
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/library-paths/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete library directory");
      await loadDirectories();
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "Failed to delete directory");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (entry: LibraryDirectory) => {
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/library-paths/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !entry.enabled })
      });
      if (!res.ok) throw new Error("Failed to update library directory");
      await loadDirectories();
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "Failed to update directory");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (path: string) => {
    if (!path) return;
    setSaving(true);
    setActionError(null);
    try {
      if (dialogMode === "create") {
        await createDirectory(path);
      } else if (activeDirectory) {
        await updateDirectoryPath(activeDirectory.id, path);
      }
      setDialogOpen(false);
      setActiveDirectory(null);
      await loadDirectories();
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "Failed to save directory");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Library Directories</CardTitle>
          <CardDescription>
            Select directories containing finished audiobooks. They’re scanned in place to keep the catalog current.
          </CardDescription>
        </div>
        <Button onClick={startCreate} disabled={saving || loading}>
          <Plus className="mr-2 h-4 w-4" />
          Add Directory
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {actionError && !dialogOpen && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {actionError}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading directories…</p>
        ) : directories.length === 0 ? (
          <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-dashed p-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-base font-medium text-foreground">No library directories yet</p>
              <p className="text-sm text-muted-foreground">
                Add a library location so new imports sync directly to your catalog.
              </p>
            </div>
            <Button onClick={startCreate} disabled={saving}>Add directory</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {directories.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-2 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{entry.name}</p>
                    <p className="text-sm text-muted-foreground">{entry.path}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(entry)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleEnabled(entry)} disabled={saving}>
                      {entry.enabled ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteDirectory(entry.id)} disabled={saving}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {entry.book_count != null && <p>Books indexed: {entry.book_count}</p>}
                  {entry.last_scanned_at && <p>Last scanned: {new Date(entry.last_scanned_at).toLocaleString()}</p>}
                  {!entry.enabled && <p className="font-medium uppercase">Disabled</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <DirectoryEditorDialog
        root="library"
        mode={dialogMode}
        open={dialogOpen}
        initialPath={activeDirectory?.path}
        saving={saving}
        error={dialogOpen ? actionError : null}
        onOpenChange={handleDialogOpenChange}
        onSubmit={handleSubmit}
      />
    </Card>
  );
}

function deriveName(fullPath: string) {
  const trimmed = fullPath.trim();
  if (!trimmed) return "Library";
  const segments = trimmed.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] ?? trimmed;
}
