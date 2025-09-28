"use client";

import React from "react";
import { ArrowLeft, ChevronRight, Folder, Home } from "lucide-react";

import { Button } from "@/components/ui/button";

interface FilesystemEntry {
  name: string;
  path: string;
  full_path: string;
  is_dir: boolean;
}

interface ListingResponse {
  path: string;
  full_path: string;
  entries: FilesystemEntry[];
}

interface FileExplorerProps {
  root: "library" | "import";
  initialPath?: string;
  onSelect: (selection: { relativePath: string; fullPath: string }) => void;
}

export function FileExplorer({ root, initialPath = "", onSelect }: FileExplorerProps) {
  const [currentPath, setCurrentPath] = React.useState(initialPath);
  const [listing, setListing] = React.useState<ListingResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (path) params.set("path", path);
      const res = await fetch(`/api/v1/admin/filesystem/${root}/browse?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load directories (${res.status})`);
      const payload = await res.json();
      const listingResponse = payload.data as ListingResponse;
      setListing(listingResponse);
      setCurrentPath(listingResponse.path ?? "");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load directories");
    } finally {
      setLoading(false);
    }
  }, [root]);

  React.useEffect(() => {
    load(initialPath);
  }, [load, initialPath]);

  const goUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    load(parts.join("/"));
  };

  const goHome = () => {
    load("");
  };

  const enterDirectory = (entry: FilesystemEntry) => {
    if (!entry.is_dir) return;
    load(entry.path);
  };

  const selectCurrentDirectory = () => {
    if (!listing) return;
    onSelect({ relativePath: listing.path ?? "", fullPath: listing.full_path ?? "" });
  };

  const selectDirectory = (entry: FilesystemEntry) => {
    if (!entry.is_dir) return;
    onSelect({ relativePath: entry.path, fullPath: entry.full_path });
  };

  const breadcrumbs = React.useMemo(() => {
    const relativeParts = (listing?.path ?? "").split("/").filter(Boolean);
    const items: Array<{ name: string; path: string }> = [];
    const rootLabel = root === "library" ? "Library" : "Import";

    items.push({ name: rootLabel, path: "" });

    let buildPath = "";
    for (const part of relativeParts) {
      buildPath = buildPath ? `${buildPath}/${part}` : part;
      items.push({ name: part, path: buildPath });
    }

    return items;
  }, [listing?.path, root]);

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="mb-4 text-destructive">{error}</p>
        <Button onClick={() => load("")} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-72 flex-col overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={goHome} disabled={loading}>
              <Home className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={goUp} disabled={loading || !currentPath}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1 overflow-hidden text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={`${crumb.name}-${crumb.path}`}>
                {index > 0 && <ChevronRight className="h-3 w-3 flex-shrink-0" />}
                <button
                  type="button"
                  onClick={() => load(crumb.path)}
                  className="truncate whitespace-nowrap transition hover:text-primary"
                  disabled={loading}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
        <Button onClick={selectCurrentDirectory} disabled={loading || !listing} size="sm" variant="default">
          Select This Folder
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading directories…
          </div>
        ) : listing?.entries?.length ? (
          <div className="space-y-2">
            {listing.entries.map((entry) => {
              if (!entry.is_dir) return null;
              return (
                <div
                  key={entry.full_path}
                  className="group flex items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 transition hover:border-border hover:bg-muted/40"
                  onDoubleClick={() => enterDirectory(entry)}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                      <Folder className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{entry.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{entry.path || "/"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 px-4 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        selectDirectory(entry);
                      }}
                    >
                      Select Folder
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No subfolders here yet.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        <span>{listing?.entries?.filter((entry) => entry.is_dir).length ?? 0} folder(s)</span>
        {listing?.full_path && <span className="truncate">{listing.full_path}</span>}
      </div>
    </div>
  );
}
