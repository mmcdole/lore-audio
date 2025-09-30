package server

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

// Library handlers (personal collection)
func (h *handler) handleLibraryList(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		respondError(w, http.StatusUnauthorized, "user not found in context")
		return
	}

	offset, limit := getPagination(r)
	libraryID := strings.TrimSpace(r.URL.Query().Get("library_id"))
	audiobooks, total, err := h.svc.ListUserLibrary(r.Context(), user.ID, libraryID, offset, limit)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": audiobooks,
		"pagination": map[string]interface{}{
			"offset": offset,
			"limit":  limit,
			"total":  total,
		},
	})
}

func (h *handler) handleLibraryGet(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		respondError(w, http.StatusUnauthorized, "user not found in context")
		return
	}

	id := chi.URLParam(r, "audiobook_id")
	audiobook, err := h.svc.GetLibraryItem(r.Context(), id, user.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(w, http.StatusNotFound, "audiobook not found in library")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"data": audiobook})
}


func (h *handler) handleLibraryProgress(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		respondError(w, http.StatusUnauthorized, "user not found in context")
		return
	}

	id := chi.URLParam(r, "audiobook_id")
	var req struct {
		ProgressSec float64 `json:"progress_sec"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	data, err := h.svc.UpdateProgress(r.Context(), user.ID, id, req.ProgressSec)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(w, http.StatusNotFound, "audiobook not found in library")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message":   "Progress updated successfully.",
		"user_data": data,
	})
}

func (h *handler) handleLibraryFavorite(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		respondError(w, http.StatusUnauthorized, "user not found in context")
		return
	}

	id := chi.URLParam(r, "audiobook_id")
	var req struct {
		IsFavorite bool `json:"is_favorite"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	data, err := h.svc.SetFavorite(r.Context(), user.ID, id, req.IsFavorite)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(w, http.StatusNotFound, "audiobook not found in library")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"user_data": data})
}

func (h *handler) handleLibraryFavorites(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		respondError(w, http.StatusUnauthorized, "user not found in context")
		return
	}

	offset, limit := getPagination(r)
	libraryID := strings.TrimSpace(r.URL.Query().Get("library_id"))
	
	var libraryRef *string
	if libraryID != "" {
		libraryRef = &libraryID
	}
	
	audiobooks, total, err := h.svc.GetUserFavorites(r.Context(), user.ID, libraryRef, offset, limit)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": audiobooks,
		"pagination": map[string]interface{}{
			"offset": offset,
			"limit":  limit,
			"total":  total,
		},
	})
}

func (h *handler) handleLibraryContinue(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		respondError(w, http.StatusUnauthorized, "user not found in context")
		return
	}

	libraryID := strings.TrimSpace(r.URL.Query().Get("library_id"))
	
	var libraryRef *string
	if libraryID != "" {
		libraryRef = &libraryID
	}
	
	// Default to 20 items for continue listening
	limit := 20
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}
	
	audiobooks, err := h.svc.GetContinueListening(r.Context(), user.ID, libraryRef, limit)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, audiobooks)
}

