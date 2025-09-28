"use client";

import { useMemo, useState } from "react";
import { Filter, Loader2, Search as SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCatalogQuery } from "@/lib/api/hooks";
import { useLibraryContext } from "@/providers/library-provider";

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { selectedLibraryId } = useLibraryContext();
  const { data, isPending } = useCatalogQuery({
    search: searchTerm,
    libraryId: selectedLibraryId,
    enabled: Boolean(selectedLibraryId),
  });

  const results = useMemo(() => data?.data ?? [], [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            Advanced search
          </h2>
          <p className="text-sm text-muted-foreground">
            Find audiobooks by title, author, narrator, or metadata. Filters and
            smart suggestions coming soon.
          </p>
        </div>
        <Button variant="glass" className="gap-2">
          <Filter className="h-4 w-4" /> Saved filters
        </Button>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search the entire catalog..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="h-14 rounded-2xl pl-12 text-lg"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {isPending
              ? "Searching..."
              : !selectedLibraryId
                ? "Select a library to search"
                : `${results.length} result${results.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isPending ? (
            <div className="col-span-full flex justify-center py-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !selectedLibraryId ? (
            <Card className="col-span-full border-dashed border-primary/40 bg-background/40 p-12 text-center">
              <CardTitle>Select a library</CardTitle>
              <CardDescription className="mt-2">
                Choose a library to begin searching its catalog.
              </CardDescription>
            </Card>
          ) : results.length > 0 ? (
            results.map((book) => (
              <Card
                key={book.id}
                className="flex flex-col gap-3 border border-border/20 bg-card/80 p-6"
              >
                <CardHeader className="p-0">
                  <CardTitle className="line-clamp-2 text-lg">
                    {book.metadata?.title ??
                      book.asset_path.split("/").pop() ??
                      "Untitled"}
                  </CardTitle>
                  <CardDescription className="line-clamp-1">
                    {book.metadata?.author ?? "Unknown author"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 p-0 text-xs text-muted-foreground">
                  <p className="line-clamp-3 text-sm">
                    {book.metadata?.description ??
                      "No description available yet."}
                  </p>
                  <div className="flex items-center justify-between">
                    <span>Files</span>
                    <span>{book.stats?.file_count ?? 0}</span>
                  </div>
                </CardContent>
                <Button
                  variant="ghost"
                  className="justify-start px-0 text-sm text-primary"
                >
                  View audiobook
                </Button>
              </Card>
            ))
          ) : (
            <Card className="col-span-full border-dashed border-primary/40 bg-background/40 p-12 text-center">
              <CardTitle>No matches yet</CardTitle>
              <CardDescription className="mt-2">
                Try adjusting your search keywords or explore the library to
                discover something new.
              </CardDescription>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
