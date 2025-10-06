"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { User, Search, Grid3x3, Grid2x2, LayoutGrid } from "lucide-react";

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

export default function AuthorsPage() {
  const [authorSearch, setAuthorSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("medium");
  const { selectedLibraryId } = useLibraryContext();

  const { data, isPending } = useCatalogQuery({
    search: "",
    libraryId: selectedLibraryId,
  });

  const books = data?.data ?? [];

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

  // Filter authors by search
  const filteredAuthors = useMemo(() => {
    if (!authorSearch) {
      return authorGroups;
    }
    const query = authorSearch.toLowerCase();
    return authorGroups.filter(([author]) => author.toLowerCase().includes(query));
  }, [authorGroups, authorSearch]);

  const authorCount = authorGroups.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/95 px-6 py-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Authors</h1>
            <p className="text-sm text-muted-foreground">
              {authorCount === 0
                ? "No authors found"
                : `${authorCount} ${authorCount === 1 ? "author" : "authors"}`}
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="border-b border-border/40 bg-background/95 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search authors..."
              className="pl-9"
              value={authorSearch}
              onChange={(e) => setAuthorSearch(e.target.value)}
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

      {/* Authors List */}
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
                  <div className={VIEW_GRID_CLASSES[viewMode]}>
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
            <User className="h-12 w-12" />
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
