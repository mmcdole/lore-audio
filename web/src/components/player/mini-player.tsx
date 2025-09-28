"use client";

import Image from "next/image";
import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePlayerStore, selectCurrentTrack } from "@/state/player-store";

export function MiniPlayer() {
  const currentTrack = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);
  const volume = usePlayerStore((state) => state.volume);

  if (!currentTrack) {
    return null;
  }

  return (
    <div className="glass-surface sticky bottom-0 z-30 flex items-center justify-between gap-4 border-t border-border/40 px-4 py-3 backdrop-blur-xl">
      <div className="flex flex-1 items-center gap-3">
        <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-border/40">
          {currentTrack.coverUrl ? (
            <Image src={currentTrack.coverUrl} alt={currentTrack.title} fill sizes="48px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">🎧</div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{currentTrack.title}</p>
          <p className="truncate text-xs text-muted-foreground">{currentTrack.author}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={previous} aria-label="Previous track">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          variant="glass"
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={() => togglePlay()}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={next} aria-label="Next track">
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
      <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
        <Volume2 className="h-4 w-4" />
        <span>{Math.round(volume * 100)}%</span>
      </div>
    </div>
  );
}
