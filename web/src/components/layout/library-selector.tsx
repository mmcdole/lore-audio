"use client";

import { Loader2 } from "lucide-react";

import { useLibraryContext } from "@/providers/library-provider";

export function LibrarySelector() {
  const { libraries, selectedLibraryId, setSelectedLibraryId, isLoading } =
    useLibraryContext();

  if (isLoading && libraries.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-border/40 bg-card/60 px-4 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading libraries
      </div>
    );
  }

  if (libraries.length <= 1) {
    const library = libraries[0];
    return (
      <div className="flex items-center gap-2 rounded-full border border-border/40 bg-card/60 px-4 py-2 text-sm">
        <span className="text-muted-foreground">Library</span>
        <span className="font-medium text-foreground">
          {library?.display_name ?? "Default"}
        </span>
      </div>
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Library</span>
      <select
        value={selectedLibraryId ?? ""}
        onChange={(event) => setSelectedLibraryId(event.target.value)}
        className="rounded-full border border-border/40 bg-card/60 px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none"
      >
        {libraries.map((library) => (
          <option key={library.id} value={library.id}>
            {library.display_name}
          </option>
        ))}
      </select>
    </label>
  );
}
