"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import {
  ArrowLeft,
  Clock,
  Headphones,
  Heart,
  Play,
  Star,
  User,
  MoreVertical,
  Link as LinkIcon,
  Trash2,
  CheckCircle,
  RotateCcw,
  Pencil,
  Lock,
  LockOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAudiobookQuery, useCatalogQuery } from "@/lib/api/hooks";
import { apiFetch } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";

export default function AudiobookDetailPage() {
  const queryClient = useQueryClient();
  const { apiKey } = useAuth();
  const params = useParams();
  const audiobookId = params.id as string;
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"audible" | "google">("audible");

  // Edit form state with source/lock/custom tracking
  type Source = "agent" | "file" | "custom";
  type FieldState = {
    source: Source;
    locked: boolean;
    customValue: string;
    agentValue: string;
    fileValue: string;
  };

  const [editForm, setEditForm] = useState<Record<string, FieldState>>({
    title: { source: "agent", locked: false, customValue: "", agentValue: "", fileValue: "" },
    subtitle: { source: "agent", locked: false, customValue: "", agentValue: "", fileValue: "" },
    author: { source: "agent", locked: false, customValue: "", agentValue: "", fileValue: "" },
    narrator: { source: "agent", locked: false, customValue: "", agentValue: "", fileValue: "" },
    description: { source: "agent", locked: false, customValue: "", agentValue: "", fileValue: "" },
  });

  // Active tab in metadata dialog
  const [metadataTab, setMetadataTab] = useState("edit");

  // Fetch single audiobook detail - includes all metadata layers
  const { data: audiobook, isPending, error } = useAudiobookQuery(audiobookId);

  // Fetch catalog for related books feature
  const { data: catalogData } = useCatalogQuery({ libraryId: null });
  const allBooks = catalogData?.data ?? [];

  // Clear search results when provider changes
  useEffect(() => {
    setSearchResults([]);
  }, [selectedProvider]);

  const handleSearchMetadata = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const authorParam = audiobook?.metadata?.author ? `&author=${encodeURIComponent(audiobook.metadata.author)}` : '';
      const response = await apiFetch(
        `/metadata/search?provider=${selectedProvider}&title=${encodeURIComponent(searchQuery)}${authorParam}`,
        { authToken: apiKey ?? undefined }
      );
      setSearchResults(response || []);
    } catch (err) {
      console.error("Failed to search metadata:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleMatchMetadata = async (externalId: string) => {
    try {
      await apiFetch(`/admin/audiobooks/${audiobookId}/metadata/link`, {
        method: 'POST',
        authToken: apiKey ?? undefined,
        body: JSON.stringify({
          provider: selectedProvider,
          external_id: externalId,
        }),
      });

      setMatchDialogOpen(false);
      setEditDialogOpen(false);

      // Invalidate catalog query to refetch data after closing dialog
      await queryClient.invalidateQueries({ queryKey: ['catalog'] });
    } catch (err) {
      console.error("Failed to match metadata:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`Failed to link metadata: ${errorMessage}`);
    }
  };

  // Find related books (same series or author)
  const relatedBooks = useMemo(() => {
    if (!audiobook?.metadata) return [];

    const seriesInfo = audiobook.metadata.series_info;
    const author = audiobook.metadata.author;

    return allBooks
      .filter((book) => {
        if (book.id === audiobookId) return false;

        // Match by series
        if (seriesInfo && book.metadata?.series_info) {
          try {
            const currentSeries = typeof seriesInfo === 'string' ? JSON.parse(seriesInfo) : seriesInfo;
            const bookSeries = typeof book.metadata.series_info === 'string'
              ? JSON.parse(book.metadata.series_info)
              : book.metadata.series_info;
            if (currentSeries.name === bookSeries.name) return true;
          } catch {
            if (seriesInfo === book.metadata.series_info) return true;
          }
        }

        // Match by author
        if (author && book.metadata?.author === author) return true;

        return false;
      })
      .slice(0, 6);
  }, [audiobook, allBooks, audiobookId]);

  const progressPercent = audiobook?.user_data?.progress_sec && audiobook?.total_duration_sec
    ? Math.round((audiobook.user_data.progress_sec / audiobook.total_duration_sec) * 100)
    : 0;

  const remainingTime = audiobook?.user_data?.progress_sec && audiobook?.total_duration_sec
    ? audiobook.total_duration_sec - audiobook.user_data.progress_sec
    : audiobook?.total_duration_sec || 0;

  const isCompleted = audiobook?.user_data?.progress_sec && audiobook?.total_duration_sec
    ? audiobook.user_data.progress_sec >= audiobook.total_duration_sec
    : false;

  const handleMarkComplete = async () => {
    if (!audiobook?.total_duration_sec) return;
    try {
      // TODO: Implement mark as complete API call
      // await apiFetch(`/library/${audiobookId}/progress`, {
      //   method: 'POST',
      //   body: { progress_sec: audiobook.total_duration_sec }
      // });
      console.log("Marking as complete:", audiobookId);
    } catch (err) {
      console.error("Failed to mark as complete:", err);
    }
  };

  const handleMarkUnplayed = async () => {
    try {
      // TODO: Implement mark as unplayed API call
      // await apiFetch(`/library/${audiobookId}/progress`, {
      //   method: 'POST',
      //   body: { progress_sec: 0 }
      // });
      console.log("Marking as unplayed:", audiobookId);
    } catch (err) {
      console.error("Failed to mark as unplayed:", err);
    }
  };

  const handleOpenEditDialog = () => {
    // Load agent and file values from metadata layers
    const overrides = audiobook?.metadata_overrides?.overrides || {};

    const loadFieldState = (fieldName: string): FieldState => {
      const override = overrides[fieldName];
      // Use metadata layers directly from audiobook object
      const agentValue = (audiobook?.agent_metadata as any)?.[fieldName] || "";
      const fileValue = (audiobook?.embedded_metadata as any)?.[fieldName] || "";

      // Determine source from override
      let source: Source = "agent";
      if (override?.value) {
        source = "custom";
      } else if (override?.locked && fileValue) {
        // If locked but no custom value, it's locked to a source
        source = agentValue ? "agent" : "file";
      }

      return {
        source,
        locked: override?.locked || false,
        customValue: override?.value || "",
        agentValue: agentValue || "",
        fileValue: fileValue || "",
      };
    };

    setEditForm({
      title: loadFieldState("title"),
      subtitle: loadFieldState("subtitle"),
      author: loadFieldState("author"),
      narrator: loadFieldState("narrator"),
      description: loadFieldState("description"),
    });
    setMetadataTab("edit");
    setEditDialogOpen(true);
  };

  const handleSaveMetadata = async () => {
    try {
      // Build overrides object from editForm
      const overrides: Record<string, { value?: string; locked: boolean }> = {};

      Object.entries(editForm).forEach(([field, data]) => {
        if (data.source === "custom") {
          // Custom value - always save with locked=true and the custom value
          overrides[field] = {
            value: data.customValue || undefined,
            locked: true,
          };
        } else if (data.locked) {
          // Locked to agent or file source - save locked=true with no value
          // Server will use current agent/file value as frozen snapshot
          overrides[field] = {
            locked: true,
          };
        }
        // If source is agent/file and not locked, don't save anything (use latest from source)
      });

      await apiFetch(`/admin/audiobooks/${audiobookId}/metadata`, {
        method: 'PATCH',
        authToken: apiKey ?? undefined,
        body: JSON.stringify({ overrides }),
      });

      // Invalidate catalog query to refetch data
      queryClient.invalidateQueries({ queryKey: ['catalog'] });

      setEditDialogOpen(false);
    } catch (err) {
      console.error("Failed to save metadata:", err);
      alert("Failed to save metadata. Check console for details.");
    }
  };

  const toggleFieldLock = (field: string) => {
    setEditForm({
      ...editForm,
      [field]: { ...editForm[field], locked: !editForm[field].locked },
    });
  };

  const updateFieldSource = (field: string, source: Source) => {
    const currentField = editForm[field];
    let updates: Partial<FieldState> = { source };

    // When switching to custom, prefill with current effective value
    if (source === "custom") {
      const effectiveValue = currentField.source === "custom"
        ? currentField.customValue
        : currentField.source === "agent"
          ? currentField.agentValue
          : currentField.fileValue;
      updates.customValue = effectiveValue;
    }

    setEditForm({
      ...editForm,
      [field]: { ...currentField, ...updates },
    });
  };

  const updateFieldCustomValue = (field: string, value: string) => {
    const currentField = editForm[field];

    // If not already custom, switch to custom when they start typing
    if (currentField.source !== "custom") {
      setEditForm({
        ...editForm,
        [field]: {
          ...currentField,
          source: "custom",
          customValue: value,
        },
      });
    } else {
      // Already custom, just update the value
      setEditForm({
        ...editForm,
        [field]: {
          ...currentField,
          customValue: value,
        },
      });
    }
  };

  const setAllToAgent = () => {
    const updated = { ...editForm };
    Object.keys(updated).forEach(field => {
      updated[field] = { ...updated[field], source: "agent" as Source };
    });
    setEditForm(updated);
  };

  const setAllToFile = () => {
    const updated = { ...editForm };
    Object.keys(updated).forEach(field => {
      updated[field] = { ...updated[field], source: "file" as Source };
    });
    setEditForm(updated);
  };

  const lockAll = () => {
    const updated = { ...editForm };
    Object.keys(updated).forEach(field => {
      if (updated[field].source !== "custom") {
        updated[field] = { ...updated[field], locked: true };
      }
    });
    setEditForm(updated);
  };

  const unlockAll = () => {
    const updated = { ...editForm };
    Object.keys(updated).forEach(field => {
      updated[field] = { ...updated[field], locked: false };
    });
    setEditForm(updated);
  };

  const clearAllCustom = () => {
    const updated = { ...editForm };
    Object.keys(updated).forEach(field => {
      if (updated[field].source === "custom") {
        updated[field] = { ...updated[field], source: "agent" as Source, customValue: "" };
      }
    });
    setEditForm(updated);
  };

  const getEffectiveValue = (field: FieldState): string => {
    if (field.source === "custom") return field.customValue;
    if (field.source === "agent") return field.agentValue;
    return field.fileValue;
  };

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !audiobook) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive">Failed to load audiobook</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/library">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Library
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const seriesInfo = audiobook.metadata?.series_info ? (
    typeof audiobook.metadata.series_info === 'string'
      ? JSON.parse(audiobook.metadata.series_info)
      : audiobook.metadata.series_info
  ) : null;

  return (
    <div className="flex h-full flex-col">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-background via-background/95 to-background">
        {/* Background blur effect */}
        {audiobook.metadata?.cover_url && (
          <div
            className="absolute inset-0 opacity-20 blur-3xl"
            style={{
              backgroundImage: `url(${audiobook.metadata.cover_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}

        <div className="relative px-6 py-8">
          {/* Back button */}
          <Button asChild variant="ghost" size="sm" className="mb-6">
            <Link href="/library">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Library
            </Link>
          </Button>

          {/* Main content */}
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Cover */}
            <div className="flex-shrink-0">
              <div className="relative h-80 w-64 overflow-hidden rounded-2xl border border-border/40 bg-muted shadow-2xl">
                {audiobook.metadata?.cover_url ? (
                  <img
                    src={audiobook.metadata.cover_url}
                    alt={audiobook.metadata.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Headphones className="h-20 w-20" />
                  </div>
                )}
                {audiobook.user_data?.is_favorite && (
                  <div className="absolute right-3 top-3 rounded-full bg-primary/90 p-2 shadow-lg">
                    <Heart className="h-5 w-5 fill-current text-primary-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="flex flex-1 flex-col justify-center">
              {seriesInfo && (
                <Badge variant="outline" className="mb-3 w-fit">
                  {seriesInfo.name} #{seriesInfo.sequence || seriesInfo.position || "?"}
                </Badge>
              )}
              <h1 className="mb-2 text-4xl font-bold tracking-tight">
                {audiobook.metadata?.title || "Untitled"}
              </h1>
              {audiobook.metadata?.subtitle && (
                <p className="mb-3 text-xl text-muted-foreground">
                  {audiobook.metadata.subtitle}
                </p>
              )}
              <div className="mb-6 flex flex-wrap items-center gap-4 text-muted-foreground">
                {audiobook.metadata?.author && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{audiobook.metadata.author}</span>
                  </div>
                )}
                {audiobook.metadata?.narrator && (
                  <div className="flex items-center gap-2">
                    <Headphones className="h-4 w-4" />
                    <span>Narrated by {audiobook.metadata.narrator}</span>
                  </div>
                )}
                {audiobook.total_duration_sec && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{formatDuration(audiobook.total_duration_sec)}</span>
                  </div>
                )}
              </div>

              {/* Progress */}
              {progressPercent > 0 && (
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{progressPercent}% complete</span>
                    <span className="text-muted-foreground">
                      {formatDuration(remainingTime)} remaining
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button size="lg" className="gap-2">
                  <Play className="h-5 w-5 fill-current" />
                  {progressPercent > 0 ? "Continue" : "Play"}
                </Button>
                <Button size="lg" variant="outline">
                  <Heart className={audiobook.user_data?.is_favorite ? "fill-current" : ""} />
                </Button>
                {isCompleted ? (
                  <Button size="lg" variant="outline" onClick={handleMarkUnplayed}>
                    <RotateCcw className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button size="lg" variant="outline" onClick={handleMarkComplete}>
                    <CheckCircle className="h-5 w-5" />
                  </Button>
                )}
                <Button size="lg" variant="outline" onClick={handleOpenEditDialog}>
                  <Pencil className="h-5 w-5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="lg" variant="outline">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {audiobook.metadata_id ? (
                      <DropdownMenuItem onClick={() => {
                        // TODO: Implement unmatch/unlink functionality
                        console.log("Unmatching metadata for", audiobookId);
                      }}>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Unmatch Metadata
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => {
                        setSearchQuery(audiobook.metadata?.title || "");
                        setMatchDialogOpen(true);
                      }}>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Match Metadata
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Audiobook
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-12">
          {/* Description */}
          {audiobook.metadata?.description && (
            <section>
              <h2 className="mb-4 text-2xl font-semibold">About</h2>
              <p className="leading-relaxed text-muted-foreground">
                {audiobook.metadata.description}
              </p>
            </section>
          )}

          {/* Media Files */}
          {audiobook.media_files && audiobook.media_files.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-semibold">
                Chapters ({audiobook.media_files.length})
              </h2>
              <div className="space-y-2">
                {audiobook.media_files.map((file, index) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded-lg border border-border/40 bg-card/50 p-4 transition-colors hover:bg-card"
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </span>
                      <span className="font-medium">{file.filename}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(file.duration_sec)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related Books */}
          {relatedBooks.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold">More Like This</h2>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {relatedBooks.map((book) => (
                  <RelatedBookCard key={book.id} book={book} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Manage Metadata Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Metadata</DialogTitle>
            <DialogDescription>
              Edit fields, match with external sources, or view metadata layers.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={metadataTab} onValueChange={setMetadataTab} className="mt-4 flex flex-col flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="match">Match</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            {/* Edit Tab */}
            <TabsContent value="edit" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
              {/* Help Text */}
              <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg text-sm">
                <div className="text-muted-foreground mt-0.5">💡</div>
                <div className="text-muted-foreground">
                  Start typing in any field to create a custom value. <strong>Agent</strong> and <strong>File</strong> sources refresh automatically unless locked. Use the lock icon to prevent refresh.
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-5 pr-2">
                <MetadataField
                  label="Title"
                  id="title"
                  fieldState={editForm.title}
                  onSourceChange={(s) => updateFieldSource("title", s)}
                  onLockToggle={() => toggleFieldLock("title")}
                  onCustomValueChange={(v) => updateFieldCustomValue("title", v)}
                  placeholder="Enter custom title"
                />

                <MetadataField
                  label="Subtitle"
                  id="subtitle"
                  fieldState={editForm.subtitle}
                  onSourceChange={(s) => updateFieldSource("subtitle", s)}
                  onLockToggle={() => toggleFieldLock("subtitle")}
                  onCustomValueChange={(v) => updateFieldCustomValue("subtitle", v)}
                  placeholder="Enter custom subtitle"
                />

                <MetadataField
                  label="Author"
                  id="author"
                  fieldState={editForm.author}
                  onSourceChange={(s) => updateFieldSource("author", s)}
                  onLockToggle={() => toggleFieldLock("author")}
                  onCustomValueChange={(v) => updateFieldCustomValue("author", v)}
                  placeholder="Enter custom author"
                />

                <MetadataField
                  label="Narrator"
                  id="narrator"
                  fieldState={editForm.narrator}
                  onSourceChange={(s) => updateFieldSource("narrator", s)}
                  onLockToggle={() => toggleFieldLock("narrator")}
                  onCustomValueChange={(v) => updateFieldCustomValue("narrator", v)}
                  placeholder="Enter custom narrator"
                />

                <MetadataField
                  label="Description"
                  id="description"
                  fieldState={editForm.description}
                  onSourceChange={(s) => updateFieldSource("description", s)}
                  onLockToggle={() => toggleFieldLock("description")}
                  onCustomValueChange={(v) => updateFieldCustomValue("description", v)}
                  placeholder="Enter custom description"
                  multiline
                />
              </div>

              {/* Footer with Save/Cancel - always visible */}
              <div className="flex justify-end gap-3 pt-4 border-t flex-shrink-0">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveMetadata}>
                  Save Changes
                </Button>
              </div>
            </TabsContent>

            {/* Match Tab */}
            <TabsContent value="match" className="mt-4">
              <div className="max-h-[500px] overflow-y-auto space-y-4 pr-2">
                {/* Provider and Search */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="provider" className="text-sm font-medium mb-2 block">
                      Metadata Provider
                    </label>
                    <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as "audible" | "google")}>
                      <SelectTrigger id="provider">
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="audible">Audible</SelectItem>
                        <SelectItem value="google">Google Books</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label htmlFor="search" className="text-sm font-medium mb-2 block">
                      Search Query
                    </label>
                    <div className="flex gap-2">
                      <Input
                        id="search"
                        placeholder="Search by title, author, or ISBN..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearchMetadata()}
                      />
                      <Button onClick={handleSearchMetadata} disabled={isSearching} className="flex-shrink-0">
                        {isSearching ? "Searching..." : "Search"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Tip: Use exact spelling for best results with Audible
                    </p>
                  </div>
                </div>

                {/* Results */}
                {searchResults.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <p className="text-sm font-medium">
                      {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} found
                    </p>
                    {searchResults.map((result) => (
                      <div
                        key={result.external_id}
                        className="flex gap-4 rounded-lg border border-border/40 bg-card/50 p-4 transition-colors hover:bg-card"
                      >
                        <div className="flex-shrink-0">
                          <div className="h-24 w-16 overflow-hidden rounded bg-muted shadow-sm">
                            {result.cover_url ? (
                              <img
                                src={result.cover_url}
                                alt={result.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <Headphones className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <h4 className="font-semibold leading-tight">{result.title}</h4>
                          {result.author && (
                            <p className="text-sm text-muted-foreground">by {result.author}</p>
                          )}
                          {result.narrator && (
                            <p className="text-sm text-muted-foreground">
                              narrated by {result.narrator}
                            </p>
                          )}
                          {result.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {result.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-start pt-1">
                          <Button
                            size="sm"
                            onClick={() => handleMatchMetadata(result.external_id)}
                          >
                            Match
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty States */}
                {!isSearching && searchResults.length === 0 && searchQuery && (
                  <div className="py-12 text-center">
                    <p className="text-sm text-muted-foreground mb-2">No results found</p>
                    <p className="text-xs text-muted-foreground">
                      Try adjusting your search terms or check spelling
                    </p>
                  </div>
                )}

                {!searchQuery && (
                  <div className="py-12 text-center">
                    <Headphones className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground mb-1">
                      Search for metadata from {selectedProvider === "audible" ? "Audible" : "Google Books"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Find and link external metadata to enhance this audiobook
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-4 mt-4">
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Metadata Layers</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Shows all metadata layers in priority order. Manual overrides take precedence over agent metadata.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-border/40 bg-card/50 p-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline">Priority 1</Badge>
                      Manual Overrides
                    </h4>
                    <div className="text-xs text-muted-foreground">
                      {audiobook?.metadata_overrides?.overrides && Object.keys(audiobook.metadata_overrides.overrides).length > 0 ? (
                        <ul className="space-y-1">
                          {Object.entries(audiobook.metadata_overrides.overrides).map(([field, override]) => (
                            <li key={field}>
                              <span className="font-medium capitalize">{field}:</span>{" "}
                              {override.value || "(locked, no override value)"}
                              {override.locked && <Lock className="inline h-3 w-3 ml-1" />}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No manual overrides set</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/40 bg-card/50 p-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline">Priority 2</Badge>
                      Agent Metadata
                    </h4>
                    <div className="text-xs text-muted-foreground">
                      {audiobook?.agent_metadata ? (
                        <ul className="space-y-1">
                          {audiobook.agent_metadata.title && (
                            <li><span className="font-medium">Title:</span> {audiobook.agent_metadata.title}</li>
                          )}
                          {audiobook.agent_metadata.author && (
                            <li><span className="font-medium">Author:</span> {audiobook.agent_metadata.author}</li>
                          )}
                          {audiobook.agent_metadata.narrator && (
                            <li><span className="font-medium">Narrator:</span> {audiobook.agent_metadata.narrator}</li>
                          )}
                        </ul>
                      ) : (
                        <p>No agent metadata matched</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/40 bg-card/50 p-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline">Priority 3</Badge>
                      Embedded Metadata
                    </h4>
                    <div className="text-xs text-muted-foreground">
                      <p>ID3 tag extraction not yet implemented</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Metadata Match Dialog */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Match Metadata</DialogTitle>
            <DialogDescription>
              Search for metadata from external sources to enhance this audiobook with cover art, descriptions, and more.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Search by title, author, or ISBN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchMetadata()}
              />
              <Button onClick={handleSearchMetadata} disabled={isSearching}>
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex gap-4 rounded-lg border border-border/40 bg-card/50 p-4 transition-colors hover:bg-card"
                  >
                    {/* Cover Thumbnail */}
                    <div className="flex-shrink-0">
                      <div className="h-24 w-16 overflow-hidden rounded bg-muted">
                        {result.cover_url ? (
                          <img
                            src={result.cover_url}
                            alt={result.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Headphones className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metadata Info */}
                    <div className="flex-1 space-y-1">
                      <h4 className="font-semibold">{result.title}</h4>
                      {result.author && (
                        <p className="text-sm text-muted-foreground">by {result.author}</p>
                      )}
                      {result.narrator && (
                        <p className="text-sm text-muted-foreground">
                          narrated by {result.narrator}
                        </p>
                      )}
                      {result.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {result.description}
                        </p>
                      )}
                    </div>

                    {/* Match Button */}
                    <div className="flex items-center">
                      <Button
                        size="sm"
                        onClick={() => handleMatchMetadata(result.id)}
                      >
                        Match
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No Results */}
            {!isSearching && searchResults.length === 0 && searchQuery && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No results found. Try a different search term.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetadataField({
  label,
  id,
  fieldState,
  onSourceChange,
  onLockToggle,
  onCustomValueChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  id: string;
  fieldState: FieldState;
  onSourceChange: (source: Source) => void;
  onLockToggle: () => void;
  onCustomValueChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const getEffectiveValue = (): string => {
    if (fieldState.source === "custom") return fieldState.customValue;
    if (fieldState.source === "agent") return fieldState.agentValue;
    return fieldState.fileValue;
  };

  const getSourceLabel = () => {
    if (fieldState.source === "custom") return "Custom";
    if (fieldState.source === "agent") return "Agent";
    return "File";
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2 items-start">
        {multiline ? (
          <Textarea
            id={id}
            value={getEffectiveValue()}
            onChange={(e) => onCustomValueChange(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="flex-1"
          />
        ) : (
          <Input
            id={id}
            value={getEffectiveValue()}
            onChange={(e) => onCustomValueChange(e.target.value)}
            placeholder={placeholder}
          />
        )}
        <div className="flex gap-2 flex-shrink-0">
          <Select value={fieldState.source} onValueChange={(v) => onSourceChange(v as Source)}>
            <SelectTrigger className="w-[110px]">
              <SelectValue>{getSourceLabel()}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="file">File</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {/* Lock Toggle - always visible */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={onLockToggle}
          >
            {fieldState.locked ? (
              <Lock className="h-4 w-4 text-primary" />
            ) : (
              <LockOpen className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RelatedBookCard({ book }: { book: any }) {
  const progressPercent =
    book.user_data?.progress_sec && book.total_duration_sec
      ? Math.round((book.user_data.progress_sec / book.total_duration_sec) * 100)
      : 0;

  return (
    <Link
      href={`/library/${book.id}`}
      className="group relative overflow-hidden rounded-lg border border-border/40 bg-card transition-all hover:border-border hover:shadow-xl hover:-translate-y-1"
    >
      <div className="aspect-square overflow-hidden bg-muted">
        {book.metadata?.cover_url ? (
          <img
            src={book.metadata.cover_url}
            alt={book.metadata.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Headphones className="h-12 w-12" />
          </div>
        )}
      </div>

      {book.user_data?.is_favorite && (
        <div className="absolute right-2 top-2 rounded-full bg-primary/90 p-1.5 shadow-lg">
          <Heart className="h-3 w-3 fill-current text-primary-foreground" />
        </div>
      )}

      <div className="p-3">
        <h3 className="line-clamp-2 font-semibold text-sm">
          {book.metadata?.title || "Untitled"}
        </h3>
        <p className="mt-1 text-muted-foreground line-clamp-1 text-xs">
          {book.metadata?.author || "Unknown Author"}
        </p>

        {progressPercent > 0 && (
          <div className="mt-2">
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{progressPercent}% complete</p>
          </div>
        )}
      </div>
    </Link>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return "--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
