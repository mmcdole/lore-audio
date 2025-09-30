"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Headphones, Heart, Library as LibraryIcon, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCatalogQuery } from "@/lib/api/hooks";
import { useLibraryContext } from "@/providers/library-provider";

type FilterStatus = "all" | "not-started" | "in-progress" | "completed" | "favorites";
type SortOption = "recently-added" | "title-az" | "author-az" | "recently-played";

export default function LibraryPage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recently-added");
  const { selectedLibraryId } = useLibraryContext();

  // Apply filter from URL on mount
  useEffect(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam && ["all", "not-started", "in-progress", "completed", "favorites"].includes(filterParam)) {
      setFilterStatus(filterParam as FilterStatus);
    }
  }, [searchParams]);
  const { data, isPending } = useCatalogQuery({
    search: "", // Server-side search disabled for now
    libraryId: selectedLibraryId,
  });

  const books = data?.data ?? [];

  // Filter and sort books
  const filteredAndSortedBooks = useMemo(() => {
    let filtered = [...books];

    // Apply client-side search filter
    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (book) =>
          book.metadata?.title?.toLowerCase().includes(query) ||
          book.metadata?.author?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterStatus === "not-started") {
      filtered = filtered.filter((book) => !book.user_data || book.user_data.progress_sec === 0);
    } else if (filterStatus === "in-progress") {
      filtered = filtered.filter(
        (book) =>
          book.user_data &&
          book.user_data.progress_sec > 0 &&
          book.total_duration_sec &&
          book.user_data.progress_sec < book.total_duration_sec
      );
    } else if (filterStatus === "completed") {
      filtered = filtered.filter(
        (book) =>
          book.user_data &&
          book.total_duration_sec &&
          book.user_data.progress_sec >= book.total_duration_sec
      );
    } else if (filterStatus === "favorites") {
      filtered = filtered.filter((book) => book.user_data?.is_favorite);
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "title-az":
          return (a.metadata?.title || "").localeCompare(b.metadata?.title || "");
        case "author-az":
          return (a.metadata?.author || "").localeCompare(b.metadata?.author || "");
        case "recently-played":
          const aDate = a.user_data?.last_played_at
            ? new Date(a.user_data.last_played_at).getTime()
            : 0;
          const bDate = b.user_data?.last_played_at
            ? new Date(b.user_data.last_played_at).getTime()
            : 0;
          return bDate - aDate;
        case "recently-added":
        default:
          return 0; // Keep API order
      }
    });

    return filtered;
  }, [books, search, filterStatus, sortBy]);

  const totalCount = books.length;
  const isEmpty = books.length === 0;
  const isFiltered = filteredAndSortedBooks.length === 0 && !isEmpty;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/95 px-6 py-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LibraryIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Library</h1>
            <p className="text-sm text-muted-foreground">
              {totalCount === 0
                ? "No audiobooks yet"
                : `${totalCount} ${totalCount === 1 ? "book" : "books"}`}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      {!isEmpty && (
        <div className="border-b border-border/40 bg-background/95 px-6 py-4">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search library..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Filter chips */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={filterStatus === "all" ? "default" : "outline"}
                  onClick={() => setFilterStatus("all")}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={filterStatus === "not-started" ? "default" : "outline"}
                  onClick={() => setFilterStatus("not-started")}
                >
                  Not Started
                </Button>
                <Button
                  size="sm"
                  variant={filterStatus === "in-progress" ? "default" : "outline"}
                  onClick={() => setFilterStatus("in-progress")}
                >
                  In Progress
                </Button>
                <Button
                  size="sm"
                  variant={filterStatus === "completed" ? "default" : "outline"}
                  onClick={() => setFilterStatus("completed")}
                >
                  Completed
                </Button>
                <Button
                  size="sm"
                  variant={filterStatus === "favorites" ? "default" : "outline"}
                  onClick={() => setFilterStatus("favorites")}
                >
                  Favorites
                </Button>
              </div>

              {/* Sort dropdown */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recently-added">Recently Added</SelectItem>
                  <SelectItem value="title-az">Title A-Z</SelectItem>
                  <SelectItem value="author-az">Author A-Z</SelectItem>
                  <SelectItem value="recently-played">Recently Played</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <CatalogSkeleton />
          </div>
        ) : isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>No audiobooks found</CardTitle>
                <CardDescription>
                  This library is empty. Check back after importing some audiobooks.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : isFiltered ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <Search className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">No results found</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Try adjusting your search or filters.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setFilterStatus("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredAndSortedBooks.map((book) => (
              <Link
                key={book.id}
                href={`/library/${book.id}`}
                className="group relative overflow-hidden rounded-lg border border-border/40 bg-card p-4 transition-all hover:border-border hover:shadow-lg"
              >
                {/* Cover placeholder */}
                <div className="mb-3 aspect-square overflow-hidden rounded-md bg-muted">
                  {book.metadata?.cover_url ? (
                    <img
                      src={book.metadata.cover_url}
                      alt={book.metadata.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Headphones className="h-12 w-12" />
                    </div>
                  )}
                </div>

                {/* Favorite badge */}
                {book.user_data?.is_favorite && (
                  <div className="absolute right-6 top-6 rounded-full bg-primary/90 p-2 shadow-lg">
                    <Heart className="h-4 w-4 fill-current text-primary-foreground" />
                  </div>
                )}

                {/* Metadata */}
                <h3 className="mb-1 line-clamp-2 font-semibold">
                  {book.metadata?.title || "Untitled"}
                </h3>
                <p className="mb-2 text-sm text-muted-foreground">
                  {book.metadata?.author || "Unknown Author"}
                </p>

                {/* Progress bar if listening */}
                {book.user_data &&
                  book.user_data.progress_sec > 0 &&
                  book.total_duration_sec && (
                    <div className="mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              (book.user_data.progress_sec /
                                book.total_duration_sec) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Math.round(
                          (book.user_data.progress_sec /
                            book.total_duration_sec) *
                            100
                        )}
                        % complete
                      </p>
                    </div>
                  )}

                {/* Duration */}
                {book.total_duration_sec && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDuration(book.total_duration_sec)}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
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
