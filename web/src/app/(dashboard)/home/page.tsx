"use client";

import Link from "next/link";
import { ArrowRight, Headset, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useContinueListeningQuery } from "@/lib/api/hooks";
import { useLibraryContext } from "@/providers/library-provider";

export default function HomePage() {
  const { selectedLibraryId } = useLibraryContext();
  const { data: continueListening, isPending } =
    useContinueListeningQuery(selectedLibraryId);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-3xl border border-border/30 bg-gradient-to-br from-primary/15 via-primary/5 to-background px-8 py-12 shadow-card">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" /> Resume listening
        </p>
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Dive back into your audiobook universe
            </h2>
            <p className="max-w-xl text-base text-muted-foreground">
              Pick up right where you left off, explore freshly imported titles,
              and discover personalized recommendations powered by your
              listening habits.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/library">Browse library</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/search" className="gap-2">
                  Find new stories <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="glass-surface rounded-2xl border border-border/40 p-5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Listening streak</p>
            <p className="mt-2 text-4xl font-semibold text-primary">12 days</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              Keep it going!
            </p>
          </div>
        </div>
      </section>

      {selectedLibraryId &&
        continueListening &&
        continueListening.length > 0 && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {isPending ? (
              <SkeletonCard count={3} />
            ) : (
              continueListening.map((entry) => (
                <Card
                  key={entry.audiobook.id}
                  className="flex flex-col overflow-hidden"
                >
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Headset className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">
                        {entry.audiobook.metadata?.title ?? "Untitled"}
                      </CardTitle>
                      <CardDescription className="truncate text-xs">
                        {entry.audiobook.metadata?.author ?? "Unknown author"}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3">
                    <ProgressBar
                      progress={entry.user_data.progress_sec}
                      duration={entry.audiobook.stats?.total_duration_sec ?? 0}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Last played</span>
                      <span>
                        {entry.user_data.last_played_at
                          ? new Date(
                              entry.user_data.last_played_at
                            ).toLocaleDateString()
                          : "-"}
                      </span>
                    </div>
                    <Button asChild variant="glass">
                      <Link
                        href={`/library/${entry.audiobook.id}`}
                        className="gap-2"
                      >
                        Resume listening <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        )}
    </div>
  );
}

function SkeletonCard({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-border/30 bg-card/60 p-6"
        >
          <div className="mb-4 h-4 w-2/5 rounded bg-white/10" />
          <div className="mb-2 h-3 w-3/5 rounded bg-white/5" />
          <div className="h-3 w-4/5 rounded bg-white/5" />
        </div>
      ))}
    </>
  );
}

function ProgressBar({
  progress,
  duration,
}: {
  progress: number;
  duration: number;
}) {
  const value = duration
    ? Math.min(100, Math.round((progress / duration) * 100))
    : 0;

  return (
    <div className="space-y-2">
      <div className="h-2 w-full rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{value}% complete</p>
    </div>
  );
}
