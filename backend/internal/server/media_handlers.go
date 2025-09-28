package server

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// Media streaming
func (h *handler) handleMediaFileStream(w http.ResponseWriter, r *http.Request) {
	user := getUserFromContext(r)
	if user == nil {
		respondError(w, http.StatusUnauthorized, "user not found in context")
		return
	}

	fileID := chi.URLParam(r, "file_id")
	path, mimeType, err := h.svc.MediaFileStream(r.Context(), fileID, user.ID, user.IsAdmin)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(w, http.StatusNotFound, "media file not found")
			return
		}
		respondError(w, http.StatusForbidden, err.Error())
		return
	}

	info, statErr := os.Stat(path)
	if statErr != nil {
		if os.IsNotExist(statErr) {
			respondError(w, http.StatusNotFound, "media file missing on disk")
			return
		}
		respondError(w, http.StatusInternalServerError, statErr.Error())
		return
	}

	if info.IsDir() {
		respondError(w, http.StatusBadRequest, "media file path resolves to directory")
		return
	}

	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	
	// Support caching for better performance
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("ETag", fmt.Sprintf("\"%d-%d\"", info.ModTime().Unix(), info.Size()))
	
	// http.ServeFile already handles range requests properly
	http.ServeFile(w, r, filepath.Clean(path))
}