"use client";

import { useState } from "react";
import { Link, Search, ExternalLink, BookOpen, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data for demonstration - replace with actual API calls
const unmatchedBooks = [
  {
    id: "1",
    filename: "Project Hail Mary.m4b",
    asset_path: "/library/sci-fi/Project Hail Mary.m4b",
    created_at: "2024-09-01T10:00:00Z"
  },
  {
    id: "2",
    filename: "The Hobbit - Chapter 01.mp3",
    asset_path: "/library/fantasy/The Hobbit",
    created_at: "2024-09-02T11:30:00Z"
  }
];

const matchedBooks = [
  {
    id: "3",
    filename: "Dune.m4b",
    asset_path: "/library/sci-fi/Dune.m4b",
    metadata: {
      title: "Dune",
      author: "Frank Herbert",
      narrator: "Scott Brick",
      cover_url: null,
      description: "Set on the desert planet Arrakis..."
    }
  }
];

const searchResults = [
  {
    id: "B074CC6TJ4",
    title: "Project Hail Mary",
    author: "Andy Weir",
    narrator: "Ray Porter",
    cover_url: "https://example.com/cover.jpg",
    description: "Ryland Grace is the sole survivor on a desperate, last-chance mission..."
  }
];

export default function MetadataMatchingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBook, setSelectedBook] = useState<string | null>(null);

  const handleSearch = () => {
    // TODO: Implement search API call
    console.log("Searching for:", searchQuery);
  };

  const handleMatch = (bookId: string, metadataId: string) => {
    // TODO: Implement match API call
    console.log("Matching book", bookId, "with metadata", metadataId);
  };

  const handleUnmatch = (bookId: string) => {
    // TODO: Implement unmatch API call
    console.log("Unmatching book", bookId);
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight mb-2">Metadata Matching</h2>
        <p className="text-muted-foreground">
          Link audiobooks to external metadata sources to enrich your catalog with covers, descriptions, and series information.
        </p>
      </section>

      <Tabs defaultValue="unmatched" className="space-y-6">
        <TabsList>
          <TabsTrigger value="unmatched" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Unmatched ({unmatchedBooks.length})
          </TabsTrigger>
          <TabsTrigger value="matched" className="gap-2">
            <Link className="h-4 w-4" />
            Matched ({matchedBooks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unmatched" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audiobooks Without Metadata</CardTitle>
              <CardDescription>
                These audiobooks haven't been linked to external metadata sources yet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {unmatchedBooks.map((book) => (
                <div key={book.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-medium">{book.filename}</h4>
                      <p className="text-sm text-muted-foreground">{book.asset_path}</p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(book.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline">Unmatched</Badge>
                  </div>

                  {selectedBook === book.id && (
                    <div className="space-y-4 border-t pt-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Search for metadata (title, author, ISBN)..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        />
                        <Button onClick={handleSearch}>
                          <Search className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <h5 className="text-sm font-medium">Search Results</h5>
                        {searchResults.map((result) => (
                          <div key={result.id} className="border rounded p-3 flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="font-medium">{result.title}</p>
                              <p className="text-sm text-muted-foreground">
                                by {result.author} • narrated by {result.narrator}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button size="sm" onClick={() => handleMatch(book.id, result.id)}>
                                Match
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => setSelectedBook(selectedBook === book.id ? null : book.id)}
                  >
                    {selectedBook === book.id ? "Cancel" : "Find Metadata"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matched" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Matched Audiobooks</CardTitle>
              <CardDescription>
                These audiobooks have been successfully linked to external metadata.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {matchedBooks.map((book) => (
                <div key={book.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <BookOpen className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="font-medium">{book.metadata?.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            by {book.metadata?.author} • narrated by {book.metadata?.narrator}
                          </p>
                          <p className="text-xs text-muted-foreground">{book.filename}</p>
                        </div>
                      </div>
                      {book.metadata?.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {book.metadata.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="default">Matched</Badge>
                      <Button size="sm" variant="outline" onClick={() => handleUnmatch(book.id)}>
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}