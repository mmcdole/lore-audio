"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Library as LibraryIcon, Search, Grid3x3, Grid2x2, LayoutGrid } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCatalogQuery } from "@/lib/api/hooks";
import { useLibraryContext } from "@/providers/library-provider";

type ViewMode = "small" | "medium" | "large";

const VIEW_GRID_CLASSES = {
  small: "grid gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10",
  medium: "grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
  large: "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
};

export default function SeriesPage() {
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [seriesSearch, setSeriesSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("medium");
  const { selectedLibraryId } = useLibraryContext();

  const { data, isPending } = useCatalogQuery({
    search: "",
    libraryId: selectedLibraryId,
  });

  const books = data?.data ?? [];

  // Group books by series
  const seriesGroups = useMemo(() => {
    const groups = new Map<string, { name: string; books: typeof books }>();

    books.forEach((book) => {
      const seriesName = book.metadata?.series_name;
      if (seriesName) {
        const existing = groups.get(seriesName);
        if (existing) {
          existing.books.push(book);
        } else {
          groups.set(seriesName, { name: seriesName, books: [book] });
        }
      }
    });

    return groups;
  }, [books]);

  // Filter series by search
  const filteredSeries = useMemo(() => {
    if (!seriesSearch) {
      return Array.from(seriesGroups.entries()).sort(([a], [b]) => a.localeCompare(b));
    }
    const query = seriesSearch.toLowerCase();
    return Array.from(seriesGroups.entries())
      .filter(([seriesName]) => seriesName.toLowerCase().includes(query))
      .sort(([a], [b]) => a.localeCompare(b));
  }, [seriesGroups, seriesSearch]);

  const seriesCount = seriesGroups.size;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/95 px-6 py-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LibraryIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Series</h1>
            <p className="text-sm text-muted-foreground">
              {seriesCount === 0
                ? "No series found"
                : `${seriesCount} ${seriesCount === 1 ? "series" : "series"}`}
            </p>
          </div>
        </div>
      </div>

      {selectedSeries ? (
        // Series Detail View
        <div className="flex-1 flex flex-col">
          <div className="border-b border-border/40 bg-background/95 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <LibraryIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedSeries}</h2>
                  <p className="text-sm text-muted-foreground">
                    {seriesGroups.get(selectedSeries)?.books.length || 0} books in series
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSeries(null)}
                className="gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto px-6 py-6">
            <div className={VIEW_GRID_CLASSES[viewMode]}>
              {seriesGroups.get(selectedSeries)?.books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        // Series List View
        <>
          <div className="border-b border-border/40 bg-background/95 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search series..."
                  className="pl-9"
                  value={seriesSearch}
                  onChange={(e) => setSeriesSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1 border border-border/40 rounded-lg p-1">
                <Button
                  variant={viewMode === "small" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("small")}
                  className="h-8 w-8 p-0"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "medium" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("medium")}
                  className="h-8 w-8 p-0"
                >
                  <Grid2x2 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "large" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("large")}
                  className="h-8 w-8 p-0"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6 py-6">
            {seriesGroups.size === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                    <LibraryIcon className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h2 className="mb-2 text-xl font-semibold">No series found</h2>
                  <p className="text-sm text-muted-foreground">
                    Books with series information will appear here.
                  </p>
                </div>
              </div>
            ) : filteredSeries.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md text-center">
                  <h2 className="mb-2 text-xl font-semibold">No series found</h2>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Try adjusting your search.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setSeriesSearch("")}
                  >
                    Clear search
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredSeries.map(([seriesName, seriesData]) => (
                  <SeriesCard
                    key={seriesName}
                    seriesName={seriesName}
                    seriesBooks={seriesData.books}
                    onSeriesClick={() => setSelectedSeries(seriesName)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SeriesCard({ seriesName, seriesBooks, onSeriesClick }: { seriesName: string; seriesBooks: any[]; onSeriesClick: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const INITIAL_DISPLAY = 6;
  const showExpandButton = seriesBooks.length > INITIAL_DISPLAY;
  const displayedBooks = isExpanded ? seriesBooks : seriesBooks.slice(0, INITIAL_DISPLAY);

  const totalDuration = seriesBooks.reduce((acc, book) => acc + (book.total_duration_sec || 0), 0);
  const completedBooks = seriesBooks.filter(book =>
    book.user_data && book.total_duration_sec && book.user_data.progress_sec >= book.total_duration_sec
  ).length;
  const progressPercent = seriesBooks.length > 0 ? Math.round((completedBooks / seriesBooks.length) * 100) : 0;

  return (
    <div className="group rounded-xl border border-border/40 bg-card/50 p-6 transition-all hover:border-border hover:shadow-md">
      {/* Series Header */}
      <div
        className="mb-4 flex items-start justify-between gap-4 cursor-pointer"
        onClick={onSeriesClick}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <LibraryIcon className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-xl font-bold truncate">{seriesName}</h3>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{seriesBooks.length} {seriesBooks.length === 1 ? "book" : "books"}</span>
            <span>·</span>
            <span>{Math.round(totalDuration / 3600)}h total</span>
            {completedBooks > 0 && (
              <>
                <span>·</span>
                <span className="font-medium text-primary">{completedBooks} completed</span>
              </>
            )}
          </div>
        </div>
        {progressPercent > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative h-16 w-16">
              <svg className="h-16 w-16 -rotate-90 transform">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - progressPercent / 100)}`}
                  className="text-primary transition-all"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold">{progressPercent}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Books Grid */}
      <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
        {displayedBooks.map((book) => (
          <BookCard key={book.id} book={book} compact />
        ))}
      </div>

      {/* Show More/Less Button */}
      {showExpandButton && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-2"
          >
            {isExpanded ? (
              <>
                Show Less
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                Show {seriesBooks.length - INITIAL_DISPLAY} More
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function BookCard({ book, compact }: { book: any; compact?: boolean }) {
  const progressPercent =
    book.user_data?.progress_sec && book.total_duration_sec
      ? Math.round((book.user_data.progress_sec / book.total_duration_sec) * 100)
      : 0;

  return (
    <Link
      href={`/library/${book.id}`}
      className="group relative overflow-hidden rounded-lg border border-border/40 bg-card transition-all hover:border-border hover:shadow-xl hover:-translate-y-1"
    >
      <div className="aspect-square overflow-hidden bg-muted">
        {book.metadata?.cover_url ? (
          <img
            src={book.metadata.cover_url}
            alt={book.metadata.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <LibraryIcon className="h-12 w-12" />
          </div>
        )}
      </div>

      {book.user_data?.is_favorite && (
        <div className="absolute right-2 top-2 rounded-full bg-primary/90 p-1.5 shadow-lg">
          <svg className="h-3 w-3 fill-current text-primary-foreground" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      )}

      <div className="p-3">
        <h3 className={`line-clamp-2 font-semibold ${compact ? "text-sm" : "text-base"}`}>
          {book.metadata?.title || "Untitled"}
        </h3>
        <p className={`mt-1 text-muted-foreground line-clamp-1 ${compact ? "text-xs" : "text-sm"}`}>
          {book.metadata?.author || "Unknown Author"}
        </p>

        {progressPercent > 0 && (
          <div className="mt-2">
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{progressPercent}% complete</p>
          </div>
        )}
      </div>
    </Link>
  );
}
