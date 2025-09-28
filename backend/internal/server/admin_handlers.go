package server

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/flix-audio/backend/internal/metadata"
)

// Admin handlers
func (h *handler) handleAdminAudiobookCreate(w http.ResponseWriter, r *http.Request) {
	var req createAudiobookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.SourcePath == "" {
		respondError(w, http.StatusBadRequest, "source_path is required")
		return
	}

	audiobook, err := h.svc.CreateFromSource(r.Context(), req.SourcePath)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{"data": audiobook})
}

func (h *handler) handleAdminAudiobookDelete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "audiobook_id")
	err := h.svc.Delete(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(w, http.StatusNotFound, "audiobook not found")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": "audiobook deleted from catalog"})
}

func (h *handler) handleAdminScan(w http.ResponseWriter, r *http.Request) {
	entries, err := h.svc.LibraryScan()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"data": entries})
}

func (h *handler) handleAdminScanTrigger(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement bulk import
	respondError(w, http.StatusNotImplemented, "bulk import not yet implemented")
}

func (h *handler) handleAdminUserCreate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		IsAdmin  bool   `json:"is_admin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Username == "" || req.Password == "" {
		respondError(w, http.StatusBadRequest, "username and password are required")
		return
	}

	user, err := h.authSvc.CreateUser(r.Context(), req.Username, req.Password, req.IsAdmin)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{"data": user})
}

func (h *handler) handleAdminUserList(w http.ResponseWriter, r *http.Request) {
	offset, limit := getPagination(r)
	
	users, total, err := h.authSvc.ListUsers(r.Context(), offset, limit)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": users,
		"pagination": map[string]interface{}{
			"offset": offset,
			"limit":  limit,
			"total":  total,
		},
	})
}

func (h *handler) handleAdminUserGet(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "user_id")
	
	user, err := h.authSvc.GetUserByID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(w, http.StatusNotFound, "user not found")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": user})
}

func (h *handler) handleAdminUserUpdate(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "user_id")
	
	var req struct {
		Username *string `json:"username,omitempty"`
		IsAdmin  *bool   `json:"is_admin,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	username := ""
	if req.Username != nil {
		username = *req.Username
	}

	user, err := h.authSvc.UpdateUser(r.Context(), userID, username, req.IsAdmin)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(w, http.StatusNotFound, "user not found")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": user})
}

func (h *handler) handleAdminUserDelete(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "user_id")
	
	err := h.authSvc.DeleteUser(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "user deleted successfully"})
}

func (h *handler) handleAdminAudiobookLink(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "audiobook_id")
	var req struct {
		MetadataID string `json:"metadata_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.MetadataID == "" {
		respondError(w, http.StatusBadRequest, "metadata_id is required")
		return
	}

	audiobook, err := h.svc.LinkMetadata(r.Context(), id, req.MetadataID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(w, http.StatusNotFound, "audiobook not found")
			return
		}
		if errors.Is(err, metadata.ErrNotImplemented) {
			respondError(w, http.StatusNotImplemented, "metadata provider not configured")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": audiobook})
}

func (h *handler) handleAdminAudiobookUnlink(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "audiobook_id")
	audiobook, err := h.svc.UnlinkMetadata(r.Context(), id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(w, http.StatusNotFound, "audiobook not found")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"data": audiobook})
}

func (h *handler) handleMetadataSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		respondError(w, http.StatusBadRequest, "q parameter is required")
		return
	}

	results, err := h.svc.SearchMetadata(r.Context(), query)
	if err != nil {
		if errors.Is(err, metadata.ErrNotImplemented) {
			respondError(w, http.StatusNotImplemented, "metadata search not configured")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"data": results})
}

// Request types
type createAudiobookRequest struct {
	SourcePath string `json:"source_path"`
}