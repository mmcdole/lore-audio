"use client";

import React from "react";
import { ArrowLeft, Download, Folder, FileAudio, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface ImportDirectory {
  id: string;
  name: string;
  path: string;
}

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
  is_audiobook: boolean;
}

interface ImportJob {
  status: string;
  source_paths: string[];
  imported_books?: unknown[];
  errors?: string[];
}

export function ImportOperations() {
  const [directories, setDirectories] = React.useState<ImportDirectory[]>([]);
  const [selectedDirectory, setSelectedDirectory] = React.useState<ImportDirectory | null>(null);
  const [currentPath, setCurrentPath] = React.useState<string>("");
  const [entries, setEntries] = React.useState<FileEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = React.useState<Set<string>>(new Set());
  const [customTemplate, setCustomTemplate] = React.useState("");
  const [jobResult, setJobResult] = React.useState<ImportJob | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [browsing, setBrowsing] = React.useState(false);

  const loadDirectories = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/import/folders");
      if (!res.ok) throw new Error("Failed to load import directories");
      const payload = await res.json();
      setDirectories(payload.data ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const browse = async (directory: ImportDirectory, path: string = "") => {
    setBrowsing(true);
    try {
      const search = path ? `?path=${encodeURIComponent(path)}` : "";
      const res = await fetch(`/api/v1/admin/import/folders/${directory.id}/browse${search}`);
      if (!res.ok) throw new Error("Failed to browse directory");
      const payload = await res.json();
      setEntries(payload.data ?? []);
      setCurrentPath(path);
      setSelectedDirectory(directory);
      setSelectedEntries(new Set());
    } catch (error) {
      console.error(error);
    } finally {
      setBrowsing(false);
    }
  };

  const navigateInto = (entry: FileEntry) => {
    if (!selectedDirectory) return;
    const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    void browse(selectedDirectory, nextPath);
  };

  const navigateUp = () => {
    if (!selectedDirectory) return;
    if (!currentPath) {
      setSelectedDirectory(null);
      setEntries([]);
      return;
    }
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const next = parts.join("/");
    void browse(selectedDirectory, next);
  };

  const toggleSelection = (entry: FileEntry) => {
    const next = new Set(selectedEntries);
    if (next.has(entry.path)) {
      next.delete(entry.path);
    } else {
      next.add(entry.path);
    }
    setSelectedEntries(next);
  };

  const runImport = async () => {
    if (!selectedDirectory || selectedEntries.size === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder_id: selectedDirectory.id,
          selections: Array.from(selectedEntries),
          custom_template: customTemplate || undefined
        })
      });
      if (!res.ok) throw new Error("Import failed");
      const payload = await res.json();
      setJobResult(payload.data ?? null);
      setSelectedEntries(new Set());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadDirectories();
  }, [loadDirectories]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Import Staging Directories</CardTitle>
            <CardDescription>Select a directory to browse files and import them into the library.</CardDescription>
          </div>
          <Button variant="outline" size="icon" onClick={loadDirectories} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {directories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No enabled import directories. Configure them from the configuration section first.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {directories.map((directory) => (
                <button
                  key={directory.id}
                  className="rounded-lg border p-4 text-left transition hover:border-primary"
                  onClick={() => browse(directory)}
                >
                  <p className="font-medium">{directory.name}</p>
                  <p className="text-xs text-muted-foreground">{directory.path}</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDirectory && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Browsing {selectedDirectory.name}</CardTitle>
              <CardDescription>
                {currentPath ? `${selectedDirectory.path}/${currentPath}` : selectedDirectory.path}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={navigateUp}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Up
              </Button>
              <Button onClick={runImport} disabled={loading || selectedEntries.size === 0}>
                <Download className="mr-2 h-4 w-4" />
                Import {selectedEntries.size || ""}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Custom template override (optional)"
                value={customTemplate}
                onChange={(event) => setCustomTemplate(event.target.value)}
              />
              <Button variant="ghost" onClick={() => setCustomTemplate("")}>Clear</Button>
            </div>
            <div className="space-y-2">
              {browsing ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No files in this directory.</p>
              ) : (
                entries.map((entry) => {
                  const isSelected = selectedEntries.has(entry.path);
                  return (
                    <div key={entry.path} className="flex items-center gap-3 rounded-lg border p-3">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(entry)} />
                      <div className="flex-1">
                        <p className="font-medium flex items-center gap-2">
                          {entry.is_dir ? <Folder className="h-4 w-4" /> : <FileAudio className="h-4 w-4" />}
                          {entry.name}
                          {entry.is_audiobook && <Badge>Audio</Badge>}
                        </p>
                        {entry.size != null && !entry.is_dir && (
                          <p className="text-xs text-muted-foreground">{(entry.size / (1024 * 1024)).toFixed(1)} MB</p>
                        )}
                      </div>
                      {entry.is_dir && (
                        <Button variant="ghost" size="sm" onClick={() => navigateInto(entry)}>
                          Open
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {jobResult && (
        <Card>
          <CardHeader>
            <CardTitle>Last Import</CardTitle>
            <CardDescription>Status: {jobResult.status}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Sources: {jobResult.source_paths.join(", ")}</p>
            {jobResult.errors && jobResult.errors.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {jobResult.errors.map((err, idx) => (
                  <p key={idx}>{err}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
