"use client";

import { Library, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useLibraryContext } from "@/providers/library-provider";

export function LibrarySelector() {
  const { libraries, selectedLibraryId, setSelectedLibraryId, isLoading } =
    useLibraryContext();

  if (isLoading && libraries.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  if (libraries.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Library className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">No Libraries</span>
      </div>
    );
  }

  const selectedLibrary = libraries.find((lib) => lib.id === selectedLibraryId);
  const displayName = selectedLibrary?.display_name ?? "All Libraries";

  return (
    <div className="border-b border-border/40 pb-4">
      <Select
        value={selectedLibraryId ?? "all"}
        onValueChange={(value) => setSelectedLibraryId(value === "all" ? null : value)}
      >
        <SelectTrigger className="mx-1 h-9 rounded-lg border-0 bg-transparent px-2 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground focus:ring-0 focus:ring-offset-0 [&>svg]:h-4 [&>svg]:w-4">
          <SelectValue>{displayName}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Libraries</SelectItem>
          {libraries.map((library) => (
            <SelectItem key={library.id} value={library.id}>
              {library.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
