package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/lore/backend/internal/auth"
	"github.com/lore/backend/internal/models"
)

// =============================================================================
// Metadata Override Handlers
// =============================================================================

// UpdateAudiobookMetadataRequest represents the request body for updating metadata
type UpdateAudiobookMetadataRequest struct {
	Overrides map[string]models.FieldOverride `json:"overrides"`
}

// handleUpdateAudiobookMetadata saves manual metadata overrides for an audiobook
// PATCH /api/v1/admin/audiobooks/:id/metadata
//
// Lock Semantics (lock-to-value):
// - locked=true: MUST have a value (snapshots current value to custom)
// - locked=false: Deletes the override (reverts to cascade)
// - Invalid: {value: X, locked: false} - custom values are always locked
func (h *handler) handleUpdateAudiobookMetadata(w http.ResponseWriter, r *http.Request) {
	audiobookID := chi.URLParam(r, "id")
	if audiobookID == "" {
		http.Error(w, "audiobook ID is required", http.StatusBadRequest)
		return
	}

	var req UpdateAudiobookMetadataRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Get user from context (set by auth middleware)
	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	userID := user.ID

	// Validate lock semantics: locked fields must have values
	validatedOverrides := make(map[string]models.FieldOverride)
	for field, override := range req.Overrides {
		if override.Locked {
			// Locked must have a value (lock-to-value semantics)
			if override.Value == nil || *override.Value == "" {
				http.Error(w, fmt.Sprintf("field '%s' is locked but has no value - invalid state", field), http.StatusBadRequest)
				return
			}
			validatedOverrides[field] = override
		} else {
			// Unlocked with value is invalid (custom values are always locked)
			if override.Value != nil && *override.Value != "" {
				http.Error(w, fmt.Sprintf("field '%s' has value but is not locked - invalid state", field), http.StatusBadRequest)
				return
			}
			// Unlocked with no value means delete this override (handled by omitting from map)
			// Don't add to validatedOverrides - this effectively deletes the field
		}
	}

	// Create custom metadata with validated data
	custom := &models.CustomMetadata{
		AudiobookID: audiobookID,
		Overrides:   validatedOverrides,
		UpdatedAt:   time.Now().UTC(),
		UpdatedBy:   &userID,
	}

	// If no overrides remain, delete the entire custom metadata record
	if len(validatedOverrides) == 0 {
		if err := h.svc.DeleteMetadataOverrides(r.Context(), audiobookID); err != nil {
			http.Error(w, "failed to delete custom metadata", http.StatusInternalServerError)
			return
		}
	} else {
		// Save custom metadata
		if err := h.svc.SaveMetadataOverrides(r.Context(), custom); err != nil {
			http.Error(w, "failed to save custom metadata", http.StatusInternalServerError)
			return
		}
	}

	// Return updated audiobook with all metadata layers
	// GetLibraryItem already loads CustomMetadata via GetAudiobook
	audiobook, err := h.svc.GetLibraryItem(r.Context(), audiobookID, userID)
	if err != nil {
		http.Error(w, "failed to get audiobook", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(audiobook)
}

// handleClearMetadataOverrides removes all manual overrides for an audiobook
// DELETE /api/v1/admin/audiobooks/:id/metadata/overrides
func (h *handler) handleClearMetadataOverrides(w http.ResponseWriter, r *http.Request) {
	audiobookID := chi.URLParam(r, "id")
	if audiobookID == "" {
		http.Error(w, "audiobook ID is required", http.StatusBadRequest)
		return
	}

	if err := h.svc.DeleteMetadataOverrides(r.Context(), audiobookID); err != nil {
		http.Error(w, "failed to clear overrides", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// handleExtractEmbeddedMetadata extracts metadata from file tags (stub for now)
// POST /api/v1/admin/audiobooks/:id/metadata/extract
func (h *handler) handleExtractEmbeddedMetadata(w http.ResponseWriter, r *http.Request) {
	audiobookID := chi.URLParam(r, "id")
	if audiobookID == "" {
		http.Error(w, "audiobook ID is required", http.StatusBadRequest)
		return
	}

	// TODO: Implement actual ID3/M4B tag extraction using ffprobe
	// For now, this is a stub that does nothing

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "not_implemented",
		"message": "Embedded metadata extraction is not yet implemented",
	})
}

// MetadataLayersResponse represents all metadata layers for debugging
type MetadataLayersResponse struct {
	AgentMetadata    *models.AgentMetadata    `json:"agent_metadata,omitempty"`
	EmbeddedMetadata *models.EmbeddedMetadata `json:"embedded_metadata,omitempty"`
	CustomMetadata   *models.CustomMetadata   `json:"custom_metadata,omitempty"`
}

// handleGetMetadataLayers returns all metadata layers separately for debugging
// GET /api/v1/admin/audiobooks/:id/metadata/layers
func (h *handler) handleGetMetadataLayers(w http.ResponseWriter, r *http.Request) {
	audiobookID := chi.URLParam(r, "id")
	if audiobookID == "" {
		http.Error(w, "audiobook ID is required", http.StatusBadRequest)
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	userID := user.ID

	// Get audiobook with agent metadata
	audiobook, err := h.svc.GetLibraryItem(r.Context(), audiobookID, userID)
	if err != nil {
		http.Error(w, "audiobook not found", http.StatusNotFound)
		return
	}

	// Get embedded metadata
	embedded, _ := h.svc.GetEmbeddedMetadata(r.Context(), audiobookID)

	// Get custom metadata
	custom, _ := h.svc.GetMetadataOverrides(r.Context(), audiobookID)

	response := MetadataLayersResponse{
		AgentMetadata:    audiobook.AgentMetadata, // Use raw agent metadata, not resolved
		EmbeddedMetadata: embedded,
		CustomMetadata:   custom,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// =============================================================================
// Metadata Search Handlers
// =============================================================================

// handleSearchMetadata searches for metadata via external providers
// GET /api/v1/metadata/search?provider={provider}&title={title}&author={author}
func (h *handler) handleSearchMetadata(w http.ResponseWriter, r *http.Request) {
	provider := r.URL.Query().Get("provider")
	title := r.URL.Query().Get("title")
	author := r.URL.Query().Get("author")

	if provider == "" {
		provider = "audible" // Default provider
	}
	if title == "" {
		http.Error(w, "title parameter is required", http.StatusBadRequest)
		return
	}

	results, err := h.svc.SearchMetadata(r.Context(), provider, title, author)
	if err != nil {
		http.Error(w, fmt.Sprintf("metadata search failed: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// LinkMetadataRequest represents the request to link audiobook to agent metadata
type LinkMetadataRequest struct {
	Provider   string `json:"provider"`
	ExternalID string `json:"external_id"`
	// Optional: full metadata to save if not fetching again
	Metadata *struct {
		Title          string  `json:"title"`
		Subtitle       *string `json:"subtitle,omitempty"`
		Author         string  `json:"author"`
		Narrator       *string `json:"narrator,omitempty"`
		Description    *string `json:"description,omitempty"`
		CoverURL       *string `json:"cover_url,omitempty"`
		Publisher      *string `json:"publisher,omitempty"`
		PublishedYear  *string `json:"published_year,omitempty"`
		Language       *string `json:"language,omitempty"`
		ISBN           *string `json:"isbn,omitempty"`
		ASIN           *string `json:"asin,omitempty"`
		SeriesName     *string `json:"series_name,omitempty"`
		SeriesSequence *string `json:"series_sequence,omitempty"`
		Genres         *string `json:"genres,omitempty"`
	} `json:"metadata,omitempty"`
}

// handleLinkMetadata links an audiobook to agent metadata
// POST /api/v1/admin/audiobooks/:id/metadata/link
func (h *handler) handleLinkMetadata(w http.ResponseWriter, r *http.Request) {
	audiobookID := chi.URLParam(r, "id")
	if audiobookID == "" {
		http.Error(w, "audiobook ID is required", http.StatusBadRequest)
		return
	}

	var req LinkMetadataRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Provider == "" || req.ExternalID == "" {
		http.Error(w, "provider and external_id are required", http.StatusBadRequest)
		return
	}

	// Link the metadata (fetches from provider and saves it)
	if err := h.svc.LinkMetadata(r.Context(), audiobookID, req.Provider, req.ExternalID); err != nil {
		http.Error(w, fmt.Sprintf("failed to link metadata: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Note: Unmatch endpoint already exists at DELETE /api/v1/admin/audiobooks/{audiobook_id}/link
// See handleAdminAudiobookUnlink in admin_handlers.go
