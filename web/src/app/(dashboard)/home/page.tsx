"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Heart, Headphones, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCatalogQuery } from "@/lib/api/hooks";

export default function HomePage() {
  const { data, isPending } = useCatalogQuery({ libraryId: null });
  const books = data?.data ?? [];

  // Filter books into sections
  const continueListening = useMemo(
    () =>
      books
        .filter(
          (book) =>
            book.user_data?.progress_sec > 0 &&
            book.user_data.progress_sec < book.total_duration_sec
        )
        .sort((a, b) => {
          const aDate = a.user_data?.last_played_at
            ? new Date(a.user_data.last_played_at).getTime()
            : 0;
          const bDate = b.user_data?.last_played_at
            ? new Date(b.user_data.last_played_at).getTime()
            : 0;
          return bDate - aDate;
        })
        .slice(0, 10),
    [books]
  );

  const recentlyAdded = useMemo(
    () =>
      [...books]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 10),
    [books]
  );

  const favorites = useMemo(
    () =>
      books
        .filter((book) => book.user_data?.is_favorite)
        .sort((a, b) => {
          const aDate = a.user_data?.last_played_at
            ? new Date(a.user_data.last_played_at).getTime()
            : 0;
          const bDate = b.user_data?.last_played_at
            ? new Date(b.user_data.last_played_at).getTime()
            : 0;
          return bDate - aDate;
        })
        .slice(0, 10),
    [books]
  );

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Home</h1>
          <p className="text-sm text-muted-foreground">
            {continueListening.length === 0
              ? "Start listening to your first audiobook"
              : `${continueListening.length} ${continueListening.length === 1 ? "book" : "books"} in progress`}
          </p>
        </div>
      </div>

      {/* Content */}
      <div>
        {isPending ? (
          <div className="space-y-8">
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        ) : (
          <div className="space-y-12">
            {/* Continue Listening */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Continue Listening</h2>
                {continueListening.length > 0 && (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/library?filter=in-progress" className="gap-2">
                      View all <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
              {continueListening.length === 0 ? (
                <EmptyState
                  title="No audiobooks in progress"
                  description="Books you've started will appear here"
                  action={
                    <Button asChild>
                      <Link href="/library">Browse library</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="-mx-4 lg:-mx-8">
                  <div className="flex gap-4 overflow-x-auto px-4 pb-4 lg:px-8">
                    {continueListening.map((book) => (
                      <BookCard key={book.id} book={book} />
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Recently Added */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Recently Added</h2>
                {recentlyAdded.length > 0 && (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/library" className="gap-2">
                      View all <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
              {recentlyAdded.length === 0 ? (
                <EmptyState
                  title="No audiobooks yet"
                  description="Import audiobooks to get started"
                  action={
                    <Button asChild>
                      <Link href="/admin/imports">Import audiobooks</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="-mx-4 lg:-mx-8">
                  <div className="flex gap-4 overflow-x-auto px-4 pb-4 lg:px-8">
                    {recentlyAdded.map((book) => (
                      <BookCard key={book.id} book={book} />
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Favorites */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Favorites</h2>
                {favorites.length > 0 && (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/favorites" className="gap-2">
                      View all <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
              {favorites.length === 0 ? (
                <EmptyState
                  title="No favorites yet"
                  description="Mark books as favorites to see them here"
                  action={
                    <Button asChild>
                      <Link href="/library">Browse library</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="-mx-4 lg:-mx-8">
                  <div className="flex gap-4 overflow-x-auto px-4 pb-4 lg:px-8">
                    {favorites.map((book) => (
                      <BookCard key={book.id} book={book} />
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function BookCard({ book }: { book: any }) {
  const progressPercent =
    book.user_data?.progress_sec && book.total_duration_sec
      ? Math.round(
          (book.user_data.progress_sec / book.total_duration_sec) * 100
        )
      : 0;

  return (
    <Link
      href={`/library/${book.id}`}
      className="group relative flex-shrink-0 w-[200px] overflow-hidden rounded-lg border border-border/40 bg-card transition-all hover:border-border hover:shadow-lg"
    >
      {/* Cover */}
      <div className="aspect-square overflow-hidden bg-muted">
        {book.metadata?.cover_url ? (
          <img
            src={book.metadata.cover_url}
            alt={book.metadata.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Headphones className="h-12 w-12" />
          </div>
        )}
      </div>

      {/* Favorite badge */}
      {book.user_data?.is_favorite && (
        <div className="absolute right-2 top-2 rounded-full bg-primary/90 p-2 shadow-lg">
          <Heart className="h-3 w-3 fill-current text-primary-foreground" />
        </div>
      )}

      {/* Info */}
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-semibold">
          {book.metadata?.title || "Untitled"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
          {book.metadata?.author || "Unknown Author"}
        </p>

        {/* Progress bar */}
        {progressPercent > 0 && (
          <div className="mt-2">
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {progressPercent}% complete
            </p>
          </div>
        )}

        {/* Duration */}
        {book.total_duration_sec && (
          <p className="mt-2 text-xs text-muted-foreground">
            {formatDuration(book.total_duration_sec)}
          </p>
        )}
      </div>
    </Link>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border/40 bg-card/50 p-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Headphones className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="mb-6 text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-48 animate-pulse rounded bg-white/10" />
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-64 w-[200px] flex-shrink-0 animate-pulse rounded-lg bg-card/60"
          />
        ))}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return "--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}