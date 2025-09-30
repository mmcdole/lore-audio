"use client";

import { useMemo, useState } from "react";
import { useLibraryContext } from "@/providers/library-provider";
import { useFavoritesQuery } from "@/lib/api/hooks";
import { Heart, Library as LibraryIcon, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FilterStatus = "all" | "in-progress" | "completed";
type SortOption = "recently-added" | "title-az" | "author-az" | "recently-played";

export default function FavoritesPage() {
  const { selectedLibraryId } = useLibraryContext();
  const { data, isLoading, error} = useFavoritesQuery(selectedLibraryId);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recently-added");

  const favorites = data?.data ?? [];

  // Filter and sort favorites
  const filteredAndSortedFavorites = useMemo(() => {
    let filtered = [...favorites];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (book) =>
          book.metadata?.title?.toLowerCase().includes(query) ||
          book.metadata?.author?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterStatus === "in-progress") {
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
  }, [favorites, searchQuery, filterStatus, sortBy]);

  const isEmpty = favorites.length === 0;
  const isFiltered = filteredAndSortedFavorites.length === 0 && !isEmpty;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading favorites...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive">Failed to load favorites</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/95 px-6 py-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Heart className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Favorites</h1>
            <p className="text-sm text-muted-foreground">
              {isEmpty
                ? "No favorites yet"
                : `${data.meta.total} ${data.meta.total === 1 ? "book" : "books"}`}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      {!isEmpty && (
        <div className="border-b border-border/40 bg-background/95 px-6 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search favorites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
        {isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <Heart className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">No favorites yet</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Browse the library and mark books as favorites to see them here.
              </p>
              <Button asChild>
                <Link href="/library">
                  <LibraryIcon className="mr-2 h-4 w-4" />
                  Browse Library
                </Link>
              </Button>
            </div>
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
                  setSearchQuery("");
                  setFilterStatus("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredAndSortedFavorites.map((audiobook) => (
              <div
                key={audiobook.id}
                className="group relative overflow-hidden rounded-lg border border-border/40 bg-card p-4 transition-all hover:border-border hover:shadow-lg"
              >
                {/* Cover placeholder */}
                <div className="mb-3 aspect-square overflow-hidden rounded-md bg-muted">
                  {audiobook.metadata?.cover_url ? (
                    <img
                      src={audiobook.metadata.cover_url}
                      alt={audiobook.metadata.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <LibraryIcon className="h-12 w-12" />
                    </div>
                  )}
                </div>

                {/* Favorite badge */}
                <div className="absolute right-6 top-6 rounded-full bg-primary/90 p-2 shadow-lg">
                  <Heart className="h-4 w-4 fill-current text-primary-foreground" />
                </div>

                {/* Metadata */}
                <h3 className="mb-1 line-clamp-2 font-semibold">
                  {audiobook.metadata?.title || "Untitled"}
                </h3>
                <p className="mb-2 text-sm text-muted-foreground">
                  {audiobook.metadata?.author || "Unknown Author"}
                </p>

                {/* Progress bar if listening */}
                {audiobook.user_data &&
                  audiobook.user_data.progress_sec > 0 &&
                  audiobook.total_duration_sec && (
                    <div className="mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              (audiobook.user_data.progress_sec /
                                audiobook.total_duration_sec) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Math.round(
                          (audiobook.user_data.progress_sec /
                            audiobook.total_duration_sec) *
                            100
                        )}
                        % complete
                      </p>
                    </div>
                  )}

                {/* Duration */}
                {audiobook.total_duration_sec && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {Math.floor(audiobook.total_duration_sec / 3600)}h{" "}
                    {Math.floor((audiobook.total_duration_sec % 3600) / 60)}m
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}