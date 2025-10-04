"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Headphones, Heart, Library as LibraryIcon, Search, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCatalogQuery } from "@/lib/api/hooks";
import { useLibraryContext } from "@/providers/library-provider";
import { LibrarySelector } from "@/components/layout/library-selector";

type FilterStatus = "all" | "not-started" | "in-progress" | "completed" | "favorites";
type SortOption = "recently-added" | "title-az" | "author-az" | "recently-played";

export default function LibraryPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("books");
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [seriesSearch, setSeriesSearch] = useState("");
  const [authorSearch, setAuthorSearch] = useState("");
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
    search: "",
    libraryId: selectedLibraryId,
  });

  const books = data?.data ?? [];

  // Group books by series
  const seriesGroups = useMemo(() => {
    const groups = new Map<string, { name: string; books: typeof books }>();

    books.forEach((book) => {
      const seriesInfo = book.metadata?.series_info;
      if (seriesInfo) {
        try {
          const parsed = typeof seriesInfo === 'string' ? JSON.parse(seriesInfo) : seriesInfo;
          const seriesName = parsed.name || 'Unknown Series';
          const existing = groups.get(seriesName);
          if (existing) {
            existing.books.push(book);
          } else {
            groups.set(seriesName, { name: seriesName, books: [book] });
          }
        } catch (e) {
          // If parsing fails, use the raw string
          const existing = groups.get(seriesInfo);
          if (existing) {
            existing.books.push(book);
          } else {
            groups.set(seriesInfo, { name: seriesInfo, books: [book] });
          }
        }
      }
    });

    return groups;
  }, [books]);

  // Group books by author
  const authorGroups = useMemo(() => {
    const groups = new Map<string, typeof books>();

    books.forEach((book) => {
      const author = book.metadata?.author || "Unknown Author";
      const existing = groups.get(author) || [];
      groups.set(author, [...existing, book]);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b));
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

  // Filter authors by search
  const filteredAuthors = useMemo(() => {
    if (!authorSearch) {
      return authorGroups;
    }
    const query = authorSearch.toLowerCase();
    return authorGroups.filter(([author]) => author.toLowerCase().includes(query));
  }, [authorGroups, authorSearch]);

  // Filter and sort books for "All Books" tab
  const filteredAndSortedBooks = useMemo(() => {
    let filtered = [...books];

    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (book) =>
          book.metadata?.title?.toLowerCase().includes(query) ||
          book.metadata?.author?.toLowerCase().includes(query)
      );
    }

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
          return 0;
      }
    });

    return filtered;
  }, [books, search, filterStatus, sortBy]);

  const totalCount = books.length;
  const seriesCount = seriesGroups.size;
  const authorCount = authorGroups.length;
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
            <h1 className="text-2xl font-bold tracking-tight">Browse</h1>
            <p className="text-sm text-muted-foreground">
              {totalCount === 0
                ? "No audiobooks yet"
                : `${totalCount} ${totalCount === 1 ? "book" : "books"}`}
              {seriesCount > 0 && ` · ${seriesCount} ${seriesCount === 1 ? "series" : "series"}`}
              {authorCount > 0 && ` · ${authorCount} ${authorCount === 1 ? "author" : "authors"}`}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {!isEmpty && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="border-b border-border/40 px-6 pt-4">
            <TabsList className="h-auto bg-transparent p-0 gap-1">
              <TabsTrigger value="books" className="text-base px-6 py-3 rounded-t-lg data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-b-none">
                Books
              </TabsTrigger>
              <TabsTrigger value="series" className="text-base px-6 py-3 rounded-t-lg data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-b-none">
                Series
              </TabsTrigger>
              <TabsTrigger value="authors" className="text-base px-6 py-3 rounded-t-lg data-[state=active]:bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-b-none">
                Authors
              </TabsTrigger>
            </TabsList>
          </div>

          {/* All Books Tab */}
          <TabsContent value="books" className="flex-1 flex flex-col">
            <div className="border-b border-border/40 bg-background/95 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search library..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
                  <SelectTrigger className="w-[160px] h-10">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Show All</SelectItem>
                    <SelectItem value="not-started">Not Started</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="favorites">Favorites</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-[180px] h-10">
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

            <div className="flex-1 overflow-auto px-6 py-6">
              {isFiltered ? (
                <div className="flex h-full items-center justify-center">
                  <div className="max-w-md text-center">
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
                    <BookCard key={book.id} book={book} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Series Tab */}
          <TabsContent value="series" className="flex-1 flex flex-col">
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
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search series..."
                      className="pl-9"
                      value={seriesSearch}
                      onChange={(e) => setSeriesSearch(e.target.value)}
                    />
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
          </TabsContent>

          {/* Authors Tab */}
          <TabsContent value="authors" className="flex-1 flex flex-col">
            <div className="border-b border-border/40 bg-background/95 px-6 py-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search authors..."
                  className="pl-9"
                  value={authorSearch}
                  onChange={(e) => setAuthorSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto px-6 py-6">
              {filteredAuthors.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="max-w-md text-center">
                    <h2 className="mb-2 text-xl font-semibold">No authors found</h2>
                    <p className="mb-6 text-sm text-muted-foreground">
                      Try adjusting your search.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setAuthorSearch("")}
                    >
                      Clear search
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {filteredAuthors.map(([author, authorBooks]) => {
                  const totalDuration = authorBooks.reduce((acc, book) => acc + (book.total_duration_sec || 0), 0);
                  const completedBooks = authorBooks.filter(book =>
                    book.user_data && book.total_duration_sec && book.user_data.progress_sec >= book.total_duration_sec
                  ).length;
                  const inProgressBooks = authorBooks.filter(book =>
                    book.user_data && book.user_data.progress_sec > 0 && book.total_duration_sec && book.user_data.progress_sec < book.total_duration_sec
                  ).length;

                  return (
                    <div key={author} className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-semibold">{author}</h3>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{authorBooks.length} {authorBooks.length === 1 ? "book" : "books"}</span>
                          {completedBooks > 0 && (
                            <>
                              <span>·</span>
                              <span>{completedBooks} completed</span>
                            </>
                          )}
                          {inProgressBooks > 0 && (
                            <>
                              <span>·</span>
                              <span>{inProgressBooks} in progress</span>
                            </>
                          )}
                          <span>·</span>
                          <span>{Math.round(totalDuration / 3600)}h total</span>
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        {authorBooks.map((book) => (
                          <BookCard key={book.id} book={book} compact />
                        ))}
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {isEmpty && (
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <LibraryIcon className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">No audiobooks yet</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Import audiobooks to start building your library.
            </p>
            <Button asChild>
              <Link href="/admin/imports">Import Audiobooks</Link>
            </Button>
          </div>
        </div>
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
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
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
            <Headphones className="h-12 w-12" />
          </div>
        )}
      </div>

      {book.user_data?.is_favorite && (
        <div className="absolute right-2 top-2 rounded-full bg-primary/90 p-1.5 shadow-lg">
          <Heart className="h-3 w-3 fill-current text-primary-foreground" />
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