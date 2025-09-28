"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { Library } from "@/lib/api/types";
import { useLibrariesQuery } from "@/lib/api/hooks";

interface LibraryContextValue {
  libraries: Library[];
  isLoading: boolean;
  selectedLibraryId: string | null;
  setSelectedLibraryId: (id: string) => void;
}

const LibraryContext = createContext<LibraryContextValue | undefined>(
  undefined
);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { data: libraries = [], isPending } = useLibrariesQuery();
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!isPending && libraries.length > 0 && !selectedLibraryId) {
      setSelectedLibraryId(libraries[0]?.id ?? null);
    }
  }, [libraries, isPending, selectedLibraryId]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      libraries,
      isLoading: isPending,
      selectedLibraryId,
      setSelectedLibraryId,
    }),
    [libraries, isPending, selectedLibraryId]
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibraryContext(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibraryContext must be used within a LibraryProvider");
  }
  return context;
}
