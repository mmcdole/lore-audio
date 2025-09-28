"use client";

import React from "react";
import { Clock, FolderOpen, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdminLibrariesQuery } from "@/lib/api/hooks";
import type { Library, LibraryScanResult } from "@/lib/api/types";

export function LibraryOperations() {
  const { data: libraries = [], isPending, refetch } = useAdminLibrariesQuery();
  const [isScanning, setIsScanning] = React.useState(false);
  const [scanResults, setScanResults] = React.useState<LibraryScanResult[]>([]);

  const scanAll = async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/v1/admin/libraries/scan", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to scan libraries");
      const payload = await res.json();
      setScanResults(payload.results ?? []);
      await refetch();
    } catch (error) {
      console.error(error);
    } finally {
      setIsScanning(false);
    }
  };

  const scanSingle = async (id: string) => {
    setIsScanning(true);
    try {
      const res = await fetch(`/api/v1/admin/libraries/${id}/scan`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to scan library");
      const payload = await res.json();
      setScanResults(payload.data ? [payload.data] : []);
      await refetch();
    } catch (error) {
      console.error(error);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Libraries Overview</CardTitle>
            <CardDescription>
              Manage logical libraries and their directories.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isPending}
            >
              <RefreshCw
                className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              onClick={scanAll}
              disabled={isScanning || libraries.length === 0}
            >
              {isScanning ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Scanning
                </>
              ) : (
                <>
                  <FolderOpen className="mr-2 h-4 w-4" /> Scan All Libraries
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {libraries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No libraries configured yet. Create one to begin organizing
              audiobooks.
            </p>
          ) : (
            libraries.map((library) => (
              <LibraryCard
                key={library.id}
                library={library}
                onScan={() => scanSingle(library.id)}
                isScanning={isScanning}
              />
            ))
          )}
        </CardContent>
      </Card>

      {scanResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Scan Results</CardTitle>
            <CardDescription>
              Summary of the latest scan operations by library.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scanResults.map((result) => (
              <div key={result.library_id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">
                        {result.library_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {result.total_new_books} new books /{" "}
                        {result.total_books_found} total discovered
                      </p>
                    </div>
                    <Badge variant="outline">{result.scan_duration}</Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {result.directories.map((dir) => (
                      <div
                        key={dir.directory_id}
                        className="rounded border border-border/20 bg-card/60 p-3 text-sm"
                      >
                        <p className="font-medium text-foreground">
                          {dir.directory_path}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {dir.scan_duration}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Books found: {dir.books_found}
                        </p>
                        {dir.new_books && dir.new_books.length > 0 && (
                          <p className="text-xs text-primary">
                            {dir.new_books.length} new entries added
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LibraryCard({
  library,
  onScan,
  isScanning,
}: {
  library: Library;
  onScan: () => void;
  isScanning: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/30 bg-card/60 p-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-semibold text-foreground">
            {library.display_name}
          </p>
          <p className="text-sm text-muted-foreground">
            {library.description ?? "No description provided."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="uppercase tracking-wide">
            {library.type}
          </Badge>
          {library.book_count != null && (
            <Badge variant="secondary">{library.book_count} books</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onScan}
            disabled={isScanning}
          >
            Scan
          </Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {library.directories && library.directories.length > 0 ? (
          library.directories.map((directory) => (
            <div
              key={directory.id}
              className="rounded-md border border-border/20 bg-background/60 p-3 text-sm"
            >
              <p className="font-medium text-foreground">{directory.name}</p>
              <p className="text-xs text-muted-foreground">{directory.path}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Books</span>
                <span>{directory.book_count ?? 0}</span>
              </div>
              {directory.last_scanned_at && (
                <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />{" "}
                  {new Date(directory.last_scanned_at).toLocaleString()}
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No directories assigned.
          </p>
        )}
      </div>
    </div>
  );
}
