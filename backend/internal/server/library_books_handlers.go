package server

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	apperrors "github.com/lore/backend/internal/errors"
)

func (h *handler) handleLibraryBooksList(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		handleError(w, apperrors.ErrUnauthorized)
		return
	}

	libraryID := chi.URLParam(r, "library_id")
	if libraryID == "" {
		handleError(w, apperrors.NewValidationError("library_id", "library id is required", ""))
		return
	}

	offset, limit, err := parsePagination(r)
	if err != nil {
		handleError(w, err)
		return
	}

	audiobooks, total, err := h.svc.ListLibraryBooks(r.Context(), user.ID, libraryID, offset, limit)
	if err != nil {
		handleError(w, apperrors.Wrap(err, "failed to list library books"))
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

func (h *handler) handleLibraryBookGet(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		handleError(w, apperrors.ErrUnauthorized)
		return
	}

	libraryID := chi.URLParam(r, "library_id")
	if libraryID == "" {
		handleError(w, apperrors.NewValidationError("library_id", "library id is required", ""))
		return
	}

	audiobookID := chi.URLParam(r, "book_id")
	if err := h.validator.ValidateAudiobookID(audiobookID); err != nil {
		handleError(w, err)
		return
	}

	audiobook, err := h.svc.GetLibraryBook(r.Context(), libraryID, audiobookID, user.ID)
	if err != nil {
		handleError(w, apperrors.Wrap(err, "failed to fetch library book"))
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": audiobook})
}

func (h *handler) handleLibraryBooksSearch(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		handleError(w, apperrors.ErrUnauthorized)
		return
	}

	libraryID := chi.URLParam(r, "library_id")
	if libraryID == "" {
		handleError(w, apperrors.NewValidationError("library_id", "library id is required", ""))
		return
	}

	query := r.URL.Query().Get("q")
	if err := h.validator.ValidateSearchQuery(query); err != nil {
		handleError(w, err)
		return
	}

	offset, limit, err := parsePagination(r)
	if err != nil {
		handleError(w, err)
		return
	}

	audiobooks, total, err := h.svc.SearchLibraryBooks(r.Context(), user.ID, libraryID, query, offset, limit)
	if err != nil {
		handleError(w, apperrors.Wrap(err, "failed to search library books"))
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

func parsePagination(r *http.Request) (int, int, error) {
	offsetStr := r.URL.Query().Get("offset")
	limitStr := r.URL.Query().Get("limit")

	offset, limit := 0, 50
	var err error

	if offsetStr != "" {
		offset, err = strconv.Atoi(offsetStr)
		if err != nil || offset < 0 {
			return 0, 0, apperrors.NewValidationError("offset", "invalid offset value", offsetStr)
		}
	}

	if limitStr != "" {
		limit, err = strconv.Atoi(limitStr)
		if err != nil || limit <= 0 || limit > 100 {
			return 0, 0, apperrors.NewValidationError("limit", "invalid limit value (must be 1-100)", limitStr)
		}
	}

	return offset, limit, nil
}
