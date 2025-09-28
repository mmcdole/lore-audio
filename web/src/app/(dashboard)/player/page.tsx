"use client";

import { useMemo } from "react";
import { FastForward, Headphones, PauseCircle, PlayCircle, Rewind, RotateCcw, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePlayerStore, selectCurrentTrack } from "@/state/player-store";

export default function PlayerPage() {
  const currentTrack = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const meta = useMemo(() => {
    if (!currentTrack) {
      return {
        title: "Select an audiobook",
        caption: "Choose a title from your library to start listening." 
      };
    }
    return {
      title: currentTrack.title,
      caption: currentTrack.author
    };
  }, [currentTrack]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card className="flex min-h-[520px] flex-col gap-8 overflow-hidden border border-border/30 bg-gradient-to-br from-card/80 via-card/40 to-background/80 p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
          <div className="flex aspect-square w-full max-w-xs items-center justify-center rounded-3xl border border-border/40 bg-primary/10 text-primary shadow-card">
            <Headphones className="h-24 w-24" />
          </div>
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-widest text-primary">Now playing</p>
            <h2 className="text-4xl font-semibold text-foreground">{meta.title}</h2>
            <p className="text-base text-muted-foreground">{meta.caption}</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="ghost" className="gap-2">
                <RotateCcw className="h-4 w-4" /> Reset progress
              </Button>
              <Button variant="glass" className="gap-2">
                <Settings2 className="h-4 w-4" /> Playback options
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-6">
          <div className="h-3 rounded-full bg-white/5">
            <div className="h-full w-2/5 rounded-full bg-primary shadow-card" />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>02:32:14</span>
            <span>Remaining 04:28:56</span>
          </div>
          <div className="flex items-center justify-center gap-4 text-primary">
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Rewind 15 seconds">
              <Rewind className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={() => togglePlay()}
            >
              {isPlaying ? <PauseCircle className="h-16 w-16" /> : <PlayCircle className="h-16 w-16" />}
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Forward 30 seconds">
              <FastForward className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </Card>

      <aside className="space-y-4">
        <Card className="space-y-4 border border-border/30 bg-card/80 p-6">
          <h3 className="text-lg font-semibold text-foreground">Up next</h3>
          <p className="text-sm text-muted-foreground">
            Manage your playback queue. Drag to reorder and tap to jump into chapters.
          </p>
          <div className="space-y-3 text-sm">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between rounded-xl border border-border/20 bg-background/60 px-4 py-3">
                <div>
                  <p className="font-medium text-foreground">Chapter {index + 1}</p>
                  <p className="text-xs text-muted-foreground">20 min</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <PlayCircle className="h-5 w-5" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}
