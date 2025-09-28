"use client";

import React from "react";
import { Edit3, Plus, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DirectoryEditorDialog } from "@/components/admin/settings/directory-editor-dialog";

interface ImportDirectory {
  id: string;
  path: string;
  name: string;
  enabled: boolean;
  created_at?: string;
}

export function ImportDirectorySettings() {
  const [directories, setDirectories] = React.useState<ImportDirectory[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">("create");
  const [activeDirectory, setActiveDirectory] = React.useState<ImportDirectory | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const loadDirectories = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/import-folders");
      if (!res.ok) throw new Error("Failed to load import directories");
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

  const startEdit = (entry: ImportDirectory) => {
    setActiveDirectory(entry);
    setDialogMode("edit");
    setActionError(null);
    setDialogOpen(true);
  };

  const createDirectory = async (path: string) => {
    const name = deriveName(path);
    const res = await fetch("/api/v1/admin/import-folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, path, enabled: true })
    });
    if (!res.ok) throw new Error("Failed to create import directory");
  };

  const updateDirectoryPath = async (id: string, path: string) => {
    const res = await fetch(`/api/v1/admin/import-folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path })
    });
    if (!res.ok) throw new Error("Failed to update import directory");
  };

  const deleteDirectory = async (id: string) => {
    if (!confirm("Remove this import directory?")) return;
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/import-folders/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete import directory");
      await loadDirectories();
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "Failed to delete directory");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (directory: ImportDirectory) => {
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/import-folders/${directory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !directory.enabled })
      });
      if (!res.ok) throw new Error("Failed to update import directory");
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
          <CardTitle>Import Directories</CardTitle>
          <CardDescription>
            Configure staging directories admins browse when bringing new audiobooks into the library.
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
              <p className="text-base font-medium text-foreground">No import directories yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first staging folder to browse files for manual imports.
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
                {entry.created_at && (
                  <p className="text-xs text-muted-foreground">Added {new Date(entry.created_at).toLocaleString()}</p>
                )}
                {!entry.enabled && (
                  <p className="text-xs font-medium uppercase text-muted-foreground">Disabled</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <DirectoryEditorDialog
        root="import"
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
  if (!trimmed) return "Import Directory";
  const segments = trimmed.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] ?? trimmed;
}
