"use client";

import Link from "next/link";
import { useState } from "react";
import { Headphones, ListFilter, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCatalogQuery } from "@/lib/api/hooks";
import { useLibraryContext } from "@/providers/library-provider";

export default function LibraryPage() {
  const [search, setSearch] = useState("");
  const { selectedLibraryId } = useLibraryContext();
  const { data, isPending } = useCatalogQuery({
    search,
    libraryId: selectedLibraryId,
    enabled: Boolean(selectedLibraryId),
  });

  const books = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Global catalog
          </h2>
          <p className="text-sm text-muted-foreground">
            Browse audiobooks curated by your administrators.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" className="gap-2">
            <Sparkles className="h-4 w-4" /> Smart filters
          </Button>
          <Button variant="glass" className="gap-2">
            <ListFilter className="h-4 w-4" /> Filter
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Input
          placeholder="Search by title, author, narrator"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-lg bg-card/80"
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {isPending ? (
            <CatalogSkeleton />
          ) : !selectedLibraryId ? (
            <Card className="col-span-full">
              <CardHeader>
                <CardTitle>Select a library to browse</CardTitle>
                <CardDescription>
                  Please choose a library from the selector above to view its
                  catalog.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : books.length > 0 ? (
            books.map((book) => (
              <Card
                key={book.id}
                className="group flex h-full flex-col overflow-hidden border-border/20 transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-card"
              >
                <div className="relative h-52 w-full overflow-hidden border-b border-border/20">
                  <div className="flex h-full items-center justify-center bg-primary/5 text-primary">
                    <Headphones className="h-10 w-10" />
                  </div>
                </div>
                <CardHeader>
                  <CardTitle className="line-clamp-2 text-lg">
                    {book.metadata?.title ??
                      book.asset_path.split("/").pop() ??
                      "Untitled"}
                  </CardTitle>
                  <CardDescription className="line-clamp-1">
                    {book.metadata?.author ?? "Unknown author"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex flex-col gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Files</span>
                    <span>{book.stats?.file_count ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total duration</span>
                    <span>
                      {formatDuration(book.stats?.total_duration_sec ?? 0)}
                    </span>
                  </div>
                  <Button asChild variant="glass" className="mt-2">
                    <Link href={`/library/${book.id}`}>View details</Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="col-span-full">
              <CardHeader>
                <CardTitle>No audiobooks found</CardTitle>
                <CardDescription>
                  Try adjusting your search or check back after the next import.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CatalogSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-border/30 bg-card/60 p-6"
        >
          <div className="mb-4 h-48 w-full rounded-lg bg-white/5" />
          <div className="mb-2 h-4 w-2/3 rounded bg-white/10" />
          <div className="h-3 w-1/2 rounded bg-white/5" />
        </div>
      ))}
    </>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return "--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
