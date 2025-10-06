"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, useEffect, useCallback } from "react";
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
  Unlink,
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
import type { Audiobook } from "@/lib/api/types";
import { apiFetch } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";

type FieldState = {
  customValue: string;  // Custom value (can be empty if locked)
  locked: boolean;      // Whether field is locked
  agentValue: string;   // Value from agent metadata
  fileValue: string;    // Value from file tags
};

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

  // Edit form state - lock-to-value model
  const [editForm, setEditForm] = useState<Record<string, FieldState>>({
    title: { customValue: "", locked: false, agentValue: "", fileValue: "" },
    subtitle: { customValue: "", locked: false, agentValue: "", fileValue: "" },
    author: { customValue: "", locked: false, agentValue: "", fileValue: "" },
    narrator: { customValue: "", locked: false, agentValue: "", fileValue: "" },
    description: { customValue: "", locked: false, agentValue: "", fileValue: "" },
    series_name: { customValue: "", locked: false, agentValue: "", fileValue: "" },
    series_position: { customValue: "", locked: false, agentValue: "", fileValue: "" },
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
      setSearchResults(Array.isArray(response) ? response : []);
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

      // Invalidate queries to refetch updated metadata
      await queryClient.invalidateQueries({ queryKey: ['catalog'] });
      await queryClient.invalidateQueries({ queryKey: ['library', 'detail', audiobookId] });
    } catch (err) {
      console.error("Failed to match metadata:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`Failed to link metadata: ${errorMessage}`);
    }
  };

  // Find related books (same series or author)
  const relatedBooks = useMemo(() => {
    if (!audiobook?.metadata) return [];

    const seriesName = audiobook.metadata.series_name;
    const author = audiobook.metadata.author;

    return allBooks
      .filter((book) => {
        if (book.id === audiobookId) return false;

        // Match by series
        if (seriesName && book.metadata?.series_name === seriesName) return true;

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
      await apiFetch(`/library/${audiobookId}/progress`, {
        method: 'POST',
        authToken: apiKey ?? undefined,
        body: JSON.stringify({ progress_sec: audiobook.total_duration_sec }),
      });
      await queryClient.invalidateQueries({ queryKey: ['library', 'detail', audiobookId] });
      await queryClient.invalidateQueries({ queryKey: ['catalog'] });
    } catch (err) {
      console.error("Failed to mark as complete:", err);
    }
  };

  const handleMarkUnplayed = async () => {
    try {
      await apiFetch(`/library/${audiobookId}/progress`, {
        method: 'POST',
        authToken: apiKey ?? undefined,
        body: JSON.stringify({ progress_sec: 0 }),
      });
      await queryClient.invalidateQueries({ queryKey: ['library', 'detail', audiobookId] });
      await queryClient.invalidateQueries({ queryKey: ['catalog'] });
    } catch (err) {
      console.error("Failed to mark as unplayed:", err);
    }
  };

  const handleToggleFavorite = async () => {
    try {
      const newValue = !audiobook?.user_data?.is_favorite;
      await apiFetch(`/library/${audiobookId}/favorite`, {
        method: 'POST',
        authToken: apiKey ?? undefined,
        body: JSON.stringify({ is_favorite: newValue }),
      });
      await queryClient.invalidateQueries({ queryKey: ['library', 'detail', audiobookId] });
      await queryClient.invalidateQueries({ queryKey: ['catalog'] });
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  // Load form state from audiobook metadata layers
  const loadEditForm = useCallback(() => {
    if (!audiobook) return;

    const loadFieldState = (fieldName: string): FieldState => {
      // For series_position field, map to series_sequence in data model
      const dataFieldName = fieldName === "series_position" ? "series_sequence" : fieldName;

      // Load values directly from metadata layers
      let agentValue = "";
      let fileValue = "";
      let customValue = "";

      if (fieldName === "series_name" || fieldName === "series_position") {
        // Series fields: read from series_name and series_sequence columns
        agentValue = String((audiobook.agent_metadata as any)?.[dataFieldName] || "");
        fileValue = String((audiobook.embedded_metadata as any)?.[dataFieldName] || "");
      } else {
        // Normal fields: use metadata layers directly
        agentValue = (audiobook.agent_metadata as any)?.[fieldName] || "";
        fileValue = (audiobook.embedded_metadata as any)?.[fieldName] || "";
      }

      // Check if field is locked in custom metadata
      const isLocked = (audiobook.custom_metadata as any)?.locks?.[dataFieldName] === true;
      if (isLocked) {
        // Field is locked - use custom value (can be empty string)
        customValue = (audiobook.custom_metadata as any)?.[dataFieldName] || "";
      }

      return {
        customValue: customValue,
        locked: isLocked,
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
      series_name: loadFieldState("series_name"),
      series_position: loadFieldState("series_position"),
    });
  }, [audiobook]);

  // Reload form when audiobook changes and dialog is open
  useEffect(() => {
    if (editDialogOpen && audiobook) {
      loadEditForm();
    }
  }, [audiobook, editDialogOpen, loadEditForm]);

  // Reset search state when dialog closes
  useEffect(() => {
    if (!editDialogOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [editDialogOpen]);

  const handleOpenEditDialog = () => {
    setMetadataTab("edit");
    setEditDialogOpen(true);
  };

  const handleSaveMetadata = async () => {
    try {
      // Build overrides object with locked flags
      const overrides: Record<string, { value: string; locked: boolean }> = {};

      // Process all fields including series fields
      Object.entries(editForm).forEach(([field, data]) => {
        // Map series_position to series_sequence in the data model
        const dataFieldName = field === "series_position" ? "series_sequence" : field;

        overrides[dataFieldName] = {
          value: data.customValue,
          locked: data.locked,
        };
      });

      const response = await apiFetch<Audiobook>(`/admin/audiobooks/${audiobookId}/metadata`, {
        method: 'PATCH',
        authToken: apiKey ?? undefined,
        body: JSON.stringify({ overrides }),
      });

      console.log('Save response:', response);
      console.log('Custom metadata in response:', response.custom_metadata);

      // Update the query data directly with the response
      queryClient.setQueryData(['library', 'detail', audiobookId], response);

      // Force a refetch to ensure we have latest data
      await queryClient.refetchQueries({ queryKey: ['library', 'detail', audiobookId] });

      // Also invalidate to ensure other queries update
      await queryClient.invalidateQueries({ queryKey: ['catalog'], refetchType: 'active' });

      setEditDialogOpen(false);
    } catch (err) {
      console.error("Failed to save metadata:", err);
      alert("Failed to save metadata. Check console for details.");
    }
  };

  const toggleFieldLock = (field: string) => {
    const currentField = editForm[field];

    if (currentField.locked) {
      // Unlocking: clear custom value and lock flag
      setEditForm({
        ...editForm,
        [field]: {
          ...currentField,
          customValue: "",
          locked: false,
        },
      });
    } else {
      // Locking: snapshot current effective value and set lock flag
      const effectiveValue = getEffectiveValue(currentField);
      setEditForm({
        ...editForm,
        [field]: {
          ...currentField,
          customValue: effectiveValue,
          locked: true,
        },
      });
    }
  };

  const updateFieldCustomValue = (field: string, value: string) => {
    // Typing sets custom value and locks the field
    setEditForm({
      ...editForm,
      [field]: {
        ...editForm[field],
        customValue: value,
        locked: true,
      },
    });
  };

  const lockAll = () => {
    const updated = { ...editForm };
    Object.keys(updated).forEach(field => {
      if (!updated[field].locked) {
        // Not locked yet - snapshot effective value and lock
        const effectiveValue = getEffectiveValue(updated[field]);
        updated[field] = { ...updated[field], customValue: effectiveValue, locked: true };
      }
    });
    setEditForm(updated);
  };

  const unlockAll = () => {
    const updated = { ...editForm };
    Object.keys(updated).forEach(field => {
      updated[field] = { ...updated[field], customValue: "", locked: false };
    });
    setEditForm(updated);
  };

  const getEffectiveValue = (field: FieldState): string => {
    // Locked: use custom value (can be empty!)
    if (field.locked) {
      return field.customValue;
    }
    // Unlocked: cascade priority (agent → file → empty)
    return field.agentValue || field.fileValue || "";
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

  const seriesInfo = audiobook.metadata?.series_name ? {
    name: audiobook.metadata.series_name,
    sequence: audiobook.metadata.series_sequence || null
  } : null;

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
              </div>
            </div>

            {/* Metadata */}
            <div className="flex flex-1 flex-col justify-center">
              {seriesInfo && (
                <Badge variant="outline" className="mb-3 w-fit">
                  {seriesInfo.name} #{seriesInfo.sequence || "?"}
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
                <Button size="lg" variant="outline" onClick={handleToggleFavorite}>
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
                  <strong>Lock-to-Value:</strong> Type to edit any field. Saving auto-locks custom values. Click 🔒 to manually lock/unlock. Locked values won't update from metadata sources.
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-5 pr-2">
                <MetadataField
                  label="Title"
                  id="title"
                  fieldState={editForm.title}
                  onLockToggle={() => toggleFieldLock("title")}
                  onCustomValueChange={(v) => updateFieldCustomValue("title", v)}
                  placeholder="Enter custom title"
                />

                <MetadataField
                  label="Subtitle"
                  id="subtitle"
                  fieldState={editForm.subtitle}
                  onLockToggle={() => toggleFieldLock("subtitle")}
                  onCustomValueChange={(v) => updateFieldCustomValue("subtitle", v)}
                  placeholder="Enter custom subtitle"
                />

                <MetadataField
                  label="Author"
                  id="author"
                  fieldState={editForm.author}
                  onLockToggle={() => toggleFieldLock("author")}
                  onCustomValueChange={(v) => updateFieldCustomValue("author", v)}
                  placeholder="Enter custom author"
                />

                <MetadataField
                  label="Narrator"
                  id="narrator"
                  fieldState={editForm.narrator}
                  onLockToggle={() => toggleFieldLock("narrator")}
                  onCustomValueChange={(v) => updateFieldCustomValue("narrator", v)}
                  placeholder="Enter custom narrator"
                />

                <MetadataField
                  label="Series Name"
                  id="series_name"
                  fieldState={editForm.series_name}
                  onLockToggle={() => toggleFieldLock("series_name")}
                  onCustomValueChange={(v) => updateFieldCustomValue("series_name", v)}
                  placeholder="Enter series name"
                />

                <MetadataField
                  label="Series Number"
                  id="series_position"
                  fieldState={editForm.series_position}
                  onLockToggle={() => toggleFieldLock("series_position")}
                  onCustomValueChange={(v) => updateFieldCustomValue("series_position", v)}
                  placeholder="Enter series number (e.g., 1, 2.5)"
                />

                <MetadataField
                  label="Description"
                  id="description"
                  fieldState={editForm.description}
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
                {/* Current Match Display */}
                {audiobook.metadata_id && audiobook.agent_metadata && (
                  <div className="border rounded-lg p-4 bg-card">
                    <div className="flex items-center gap-4">
                      {audiobook.agent_metadata.cover_url && (
                        <img
                          src={audiobook.agent_metadata.cover_url}
                          alt={audiobook.agent_metadata.title}
                          className="w-16 h-20 rounded object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">Currently Matched</h4>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                            {audiobook.agent_metadata.source === 'audible' ? 'Audible' :
                             audiobook.agent_metadata.source === 'google' ? 'Google Books' :
                             audiobook.agent_metadata.source}
                          </span>
                        </div>
                        <p className="text-sm font-medium">
                          {audiobook.agent_metadata.title}
                        </p>
                        {audiobook.agent_metadata.author && (
                          <p className="text-xs text-muted-foreground">
                            by {audiobook.agent_metadata.author}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (confirm("Remove metadata match? Locked fields will be preserved.")) {
                            try {
                              await apiFetch(`/admin/audiobooks/${audiobookId}/link`, {
                                method: 'DELETE',
                                authToken: apiKey ?? undefined,
                              });
                              await queryClient.invalidateQueries({ queryKey: ['catalog'] });
                              await queryClient.invalidateQueries({ queryKey: ['library', 'detail', audiobookId] });
                            } catch (err) {
                              console.error("Failed to unmatch:", err);
                              const errorMsg = err instanceof Error ? err.message : String(err);
                              alert(`Failed to unmatch metadata: ${errorMsg}`);
                            }
                          }
                        }}
                      >
                        <Unlink className="h-4 w-4 mr-1" />
                        Unmatch
                      </Button>
                    </div>
                  </div>
                )}

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
                      Custom Metadata
                    </h4>
                    <div className="text-xs text-muted-foreground">
                      {audiobook?.custom_metadata ? (
                        <ul className="space-y-1">
                          {audiobook.custom_metadata.title && (
                            <li><span className="font-medium">Title:</span> {audiobook.custom_metadata.title}</li>
                          )}
                          {audiobook.custom_metadata.subtitle && (
                            <li><span className="font-medium">Subtitle:</span> {audiobook.custom_metadata.subtitle}</li>
                          )}
                          {audiobook.custom_metadata.author && (
                            <li><span className="font-medium">Author:</span> {audiobook.custom_metadata.author}</li>
                          )}
                          {audiobook.custom_metadata.narrator && (
                            <li><span className="font-medium">Narrator:</span> {audiobook.custom_metadata.narrator}</li>
                          )}
                          {audiobook.custom_metadata.description && (
                            <li><span className="font-medium">Description:</span> {audiobook.custom_metadata.description.substring(0, 100)}...</li>
                          )}
                          {audiobook.custom_metadata.series_name && (
                            <li><span className="font-medium">Series Name:</span> {audiobook.custom_metadata.series_name}</li>
                          )}
                          {audiobook.custom_metadata.series_sequence && (
                            <li><span className="font-medium">Series Number:</span> {audiobook.custom_metadata.series_sequence}</li>
                          )}
                          {audiobook.custom_metadata.cover_url && (
                            <li><span className="font-medium">Cover URL:</span> {audiobook.custom_metadata.cover_url.substring(0, 50)}...</li>
                          )}
                          {!audiobook.custom_metadata.title && !audiobook.custom_metadata.subtitle &&
                           !audiobook.custom_metadata.author && !audiobook.custom_metadata.narrator &&
                           !audiobook.custom_metadata.description && !audiobook.custom_metadata.series_name && (
                            <p>No custom metadata set</p>
                          )}
                        </ul>
                      ) : (
                        <p>No custom metadata set</p>
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
                          {audiobook.agent_metadata.subtitle && (
                            <li><span className="font-medium">Subtitle:</span> {audiobook.agent_metadata.subtitle}</li>
                          )}
                          {audiobook.agent_metadata.author && (
                            <li><span className="font-medium">Author:</span> {audiobook.agent_metadata.author}</li>
                          )}
                          {audiobook.agent_metadata.narrator && (
                            <li><span className="font-medium">Narrator:</span> {audiobook.agent_metadata.narrator}</li>
                          )}
                          {audiobook.agent_metadata.publisher && (
                            <li><span className="font-medium">Publisher:</span> {audiobook.agent_metadata.publisher}</li>
                          )}
                          {audiobook.agent_metadata.release_date && (
                            <li><span className="font-medium">Published:</span> {audiobook.agent_metadata.release_date}</li>
                          )}
                          {audiobook.agent_metadata.description && (
                            <li><span className="font-medium">Description:</span> {audiobook.agent_metadata.description.substring(0, 100)}...</li>
                          )}
                          {audiobook.agent_metadata.series_name && (
                            <li><span className="font-medium">Series Name:</span> {audiobook.agent_metadata.series_name}</li>
                          )}
                          {audiobook.agent_metadata.series_sequence && (
                            <li><span className="font-medium">Series Number:</span> {audiobook.agent_metadata.series_sequence}</li>
                          )}
                          {audiobook.agent_metadata.cover_url && (
                            <li><span className="font-medium">Cover URL:</span> {audiobook.agent_metadata.cover_url.substring(0, 50)}...</li>
                          )}
                          {audiobook.agent_metadata.source && (
                            <li><span className="font-medium">Source:</span> {audiobook.agent_metadata.source}</li>
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
  onLockToggle,
  onCustomValueChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  id: string;
  fieldState: FieldState;
  onLockToggle: () => void;
  onCustomValueChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const isLocked = fieldState.locked;

  const getEffectiveValue = (): string => {
    if (fieldState.locked) {
      return fieldState.customValue;
    }
    return fieldState.agentValue || fieldState.fileValue || "";
  };

  const getSourceInfo = () => {
    if (isLocked) {
      return { label: "Custom", variant: "default" as const };
    }
    if (fieldState.agentValue) {
      return { label: "from Audible", variant: "secondary" as const };
    }
    if (fieldState.fileValue) {
      return { label: "from File Tags", variant: "secondary" as const };
    }
    return { label: "Empty", variant: "outline" as const };
  };

  const sourceInfo = getSourceInfo();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <Badge variant={sourceInfo.variant} className="text-xs">
          {sourceInfo.label}
        </Badge>
      </div>
      <div className="flex gap-2 items-start">
        {multiline ? (
          <Textarea
            id={id}
            value={getEffectiveValue()}
            onChange={(e) => onCustomValueChange(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className={`flex-1 ${isLocked ? 'border-primary/50 bg-primary/5' : ''}`}
          />
        ) : (
          <Input
            id={id}
            value={getEffectiveValue()}
            onChange={(e) => onCustomValueChange(e.target.value)}
            placeholder={placeholder}
            className={isLocked ? 'border-primary/50 bg-primary/5' : ''}
          />
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 flex-shrink-0"
          onClick={onLockToggle}
        >
          {isLocked ? (
            <Lock className="h-4 w-4 text-primary" />
          ) : (
            <LockOpen className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
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
