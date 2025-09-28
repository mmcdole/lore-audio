import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface PlayerTrack {
  id: string;
  title: string;
  author: string;
  coverUrl?: string | null;
  durationSec: number;
  mediaFileId: string;
  audiobookId: string;
}

interface PlayerState {
  queue: PlayerTrack[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  playbackRate: number;
  positionSec: number;
  setQueue: (tracks: PlayerTrack[], startIndex?: number) => void;
  togglePlay: (isPlaying?: boolean) => void;
  seek: (positionSec: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  next: () => void;
  previous: () => void;
  updatePositionFromProgress: (progressSec: number) => void;
}

const MAX_VOLUME = 1;
const MIN_VOLUME = 0;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const usePlayerStore = create<PlayerState>()(
  devtools(
    persist(
      (set, get) => ({
        queue: [],
        currentIndex: 0,
        isPlaying: false,
        volume: 0.85,
        playbackRate: 1,
        positionSec: 0,
        setQueue: (tracks, startIndex = 0) => {
          set({
            queue: tracks,
            currentIndex: clamp(startIndex, 0, Math.max(tracks.length - 1, 0)),
            isPlaying: tracks.length > 0,
            positionSec: 0
          });
        },
        togglePlay: (nextState) => {
          const { isPlaying } = get();
          set({ isPlaying: nextState ?? !isPlaying });
        },
        seek: (positionSec) => set({ positionSec }),
        setVolume: (volume) => set({ volume: clamp(volume, MIN_VOLUME, MAX_VOLUME) }),
        setPlaybackRate: (rate) => set({ playbackRate: clamp(rate, 0.5, 3) }),
        next: () => {
          const { currentIndex, queue } = get();
          if (currentIndex < queue.length - 1) {
            set({ currentIndex: currentIndex + 1, positionSec: 0, isPlaying: true });
          }
        },
        previous: () => {
          const { currentIndex } = get();
          if (currentIndex > 0) {
            set({ currentIndex: currentIndex - 1, positionSec: 0, isPlaying: true });
          }
        },
        updatePositionFromProgress: (progressSec) => set({ positionSec: progressSec })
      }),
      {
        name: "flix-audio-player",
        partialize: (state) => ({
          queue: state.queue,
          currentIndex: state.currentIndex,
          volume: state.volume,
          playbackRate: state.playbackRate
        })
      }
    )
  )
);

export const selectCurrentTrack = (state: PlayerState) => state.queue[state.currentIndex];
