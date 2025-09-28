package server

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/flix-audio/backend/internal/auth"
	"github.com/flix-audio/backend/internal/models"
)

// Helper functions
func getUserFromContext(r *http.Request) *models.User {
	return auth.GetUserFromContext(r.Context())
}

func getPagination(r *http.Request) (offset, limit int) {
	offsetStr := r.URL.Query().Get("offset")
	limitStr := r.URL.Query().Get("limit")

	offset, _ = strconv.Atoi(offsetStr)
	limit, _ = strconv.Atoi(limitStr)

	if limit <= 0 || limit > 100 {
		limit = 50 // Default limit
	}
	if offset < 0 {
		offset = 0
	}

	return offset, limit
}

type filesystemEntry struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	IsDir    bool   `json:"is_dir"`
	FullPath string `json:"full_path"`
}

func (s *handler) handleAvailableLibraries(w http.ResponseWriter, r *http.Request) {
	libraries, err := s.librarySvc.GetLibraries(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": libraries})
}

func (s *handler) handlePublicLibraryDetails(w http.ResponseWriter, r *http.Request) {
	libraryID := chi.URLParam(r, "library_id")
	if strings.TrimSpace(libraryID) == "" {
		respondError(w, http.StatusBadRequest, "library ID is required")
		return
	}

	library, err := s.librarySvc.GetLibrary(r.Context(), libraryID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(w, http.StatusNotFound, "library not found")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": library})
}

// Administrative library path CRUD

func (s *handler) handleAdminLibraryPathList(w http.ResponseWriter, r *http.Request) {
	paths, err := s.librarySvc.ListLibraryPaths(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": paths})
}

func (s *handler) handleAdminLibraryPathCreate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if strings.TrimSpace(req.Path) == "" || strings.TrimSpace(req.Name) == "" {
		respondError(w, http.StatusBadRequest, "path and name are required")
		return
	}

	libraryPath, err := s.librarySvc.CreateLibraryPath(r.Context(), req.Path, req.Name)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{"data": libraryPath})
}

func (s *handler) handleAdminLibraryPathUpdate(w http.ResponseWriter, r *http.Request) {
	pathID := chi.URLParam(r, "id")
	if pathID == "" {
		respondError(w, http.StatusBadRequest, "library path ID is required")
		return
	}

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := s.librarySvc.UpdateLibraryPath(r.Context(), pathID, updates); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *handler) handleAdminLibraryPathDelete(w http.ResponseWriter, r *http.Request) {
	pathID := chi.URLParam(r, "id")
	if pathID == "" {
		respondError(w, http.StatusBadRequest, "library path ID is required")
		return
	}

	if err := s.librarySvc.DeleteLibraryPath(r.Context(), pathID); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Administrative import folder & settings management

func (s *handler) handleAdminImportFolderList(w http.ResponseWriter, r *http.Request) {
	folders, err := s.importSvc.ListImportFolders(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": folders})
}

func (s *handler) handleAdminImportFolderCreate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path    string `json:"path"`
		Name    string `json:"name"`
		Enabled *bool  `json:"enabled,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if strings.TrimSpace(req.Path) == "" || strings.TrimSpace(req.Name) == "" {
		respondError(w, http.StatusBadRequest, "path and name are required")
		return
	}

	folder := &models.ImportFolder{
		ID:      uuid.NewString(),
		Path:    req.Path,
		Name:    req.Name,
		Enabled: true,
	}
	if req.Enabled != nil {
		folder.Enabled = *req.Enabled
	}

	if err := s.importSvc.CreateImportFolder(r.Context(), folder); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{"data": folder})
}

func (s *handler) handleAdminImportFolderUpdate(w http.ResponseWriter, r *http.Request) {
	folderID := chi.URLParam(r, "id")
	if folderID == "" {
		respondError(w, http.StatusBadRequest, "import folder ID is required")
		return
	}

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := s.importSvc.UpdateImportFolder(r.Context(), folderID, updates); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *handler) handleAdminImportFolderDelete(w http.ResponseWriter, r *http.Request) {
	folderID := chi.URLParam(r, "id")
	if folderID == "" {
		respondError(w, http.StatusBadRequest, "import folder ID is required")
		return
	}

	if err := s.importSvc.DeleteImportFolder(r.Context(), folderID); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *handler) handleAdminImportSettingsGet(w http.ResponseWriter, r *http.Request) {
	settings, err := s.importSvc.GetImportSettings(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": settings})
}

func (s *handler) handleAdminImportSettingsUpdate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DestinationPath string `json:"destination_path"`
		Template        string `json:"template"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if strings.TrimSpace(req.DestinationPath) == "" {
		respondError(w, http.StatusBadRequest, "destination_path is required")
		return
	}

	settings := &models.ImportSettings{
		ID:              "default",
		DestinationPath: req.DestinationPath,
		Template:        req.Template,
	}

	if err := s.importSvc.UpdateImportSettings(r.Context(), settings); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": settings})
}

// Library operations

func (s *handler) handleAdminLibraryList(w http.ResponseWriter, r *http.Request) {
	libraries, err := s.librarySvc.GetLibraries(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": libraries})
}

func (s *handler) handleAdminLibraryCreate(w http.ResponseWriter, r *http.Request) {
	var req createLibraryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if strings.TrimSpace(req.DisplayName) == "" {
		respondError(w, http.StatusBadRequest, "display_name is required")
		return
	}

	library := &models.Library{
		Name:        strings.TrimSpace(req.Name),
		DisplayName: strings.TrimSpace(req.DisplayName),
		Type:        strings.TrimSpace(req.Type),
		Description: req.Description,
		Settings:    req.Settings,
	}

	created, err := s.librarySvc.CreateLibrary(r.Context(), library)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if len(req.DirectoryIDs) > 0 {
		for i := range req.DirectoryIDs {
			req.DirectoryIDs[i] = strings.TrimSpace(req.DirectoryIDs[i])
		}
		created, err = s.librarySvc.SetLibraryDirectories(r.Context(), created.ID, req.DirectoryIDs)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{"data": created})
}

func (s *handler) handleAdminLibraryGet(w http.ResponseWriter, r *http.Request) {
	libraryID := chi.URLParam(r, "id")
	if libraryID == "" {
		respondError(w, http.StatusBadRequest, "library ID is required")
		return
	}

	library, err := s.librarySvc.GetLibrary(r.Context(), libraryID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(w, http.StatusNotFound, "library not found")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": library})
}

func (s *handler) handleAdminLibraryUpdate(w http.ResponseWriter, r *http.Request) {
	libraryID := chi.URLParam(r, "id")
	if libraryID == "" {
		respondError(w, http.StatusBadRequest, "library ID is required")
		return
	}

	var req updateLibraryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	updates := map[string]interface{}{}
	if req.DisplayName != nil {
		updates["display_name"] = strings.TrimSpace(*req.DisplayName)
	}
	if req.Description != nil {
		updates["description"] = req.Description
	}
	if req.Type != nil {
		updates["type"] = strings.TrimSpace(*req.Type)
	}
	if req.Settings != nil {
		updates["settings"] = *req.Settings
	}

	var (
		library *models.Library
		err     error
	)

	if len(updates) > 0 {
		library, err = s.librarySvc.UpdateLibrary(r.Context(), libraryID, updates)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
	} else {
		library, err = s.librarySvc.GetLibrary(r.Context(), libraryID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				respondError(w, http.StatusNotFound, "library not found")
				return
			}
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	if req.DirectoryIDs != nil {
		ids := *req.DirectoryIDs
		for i := range ids {
			ids[i] = strings.TrimSpace(ids[i])
		}
		library, err = s.librarySvc.SetLibraryDirectories(r.Context(), libraryID, ids)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": library})
}

func (s *handler) handleAdminLibraryDelete(w http.ResponseWriter, r *http.Request) {
	libraryID := chi.URLParam(r, "id")
	if libraryID == "" {
		respondError(w, http.StatusBadRequest, "library ID is required")
		return
	}

	if err := s.librarySvc.DeleteLibrary(r.Context(), libraryID); err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *handler) handleAdminLibrarySetDirectories(w http.ResponseWriter, r *http.Request) {
	libraryID := chi.URLParam(r, "id")
	if libraryID == "" {
		respondError(w, http.StatusBadRequest, "library ID is required")
		return
	}

	var req libraryDirectoriesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	for i := range req.DirectoryIDs {
		req.DirectoryIDs[i] = strings.TrimSpace(req.DirectoryIDs[i])
	}

	library, err := s.librarySvc.SetLibraryDirectories(r.Context(), libraryID, req.DirectoryIDs)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": library})
}

func (s *handler) handleAdminLibraryScanAll(w http.ResponseWriter, r *http.Request) {
	results, err := s.librarySvc.ScanAllLibraries(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"results": results})
}

func (s *handler) handleAdminLibraryScanOne(w http.ResponseWriter, r *http.Request) {
	libID := chi.URLParam(r, "id")
	if libID == "" {
		respondError(w, http.StatusBadRequest, "library ID is required")
		return
	}

	result, err := s.librarySvc.ScanLibrary(r.Context(), libID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": result})
}

// Import operations

func (s *handler) handleAdminImportListFolders(w http.ResponseWriter, r *http.Request) {
	folders, err := s.importSvc.GetEnabledImportFolders(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": folders})
}

func (s *handler) handleAdminImportBrowse(w http.ResponseWriter, r *http.Request) {
	folderID := chi.URLParam(r, "folder_id")
	if folderID == "" {
		respondError(w, http.StatusBadRequest, "folder_id is required")
		return
	}

	subPath := r.URL.Query().Get("path")
	files, err := s.importSvc.BrowseFolder(r.Context(), folderID, subPath)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": files})
}

func (s *handler) handleAdminBrowseRoot(w http.ResponseWriter, r *http.Request) {
	root := chi.URLParam(r, "root")
	if root == "" {
		respondError(w, http.StatusBadRequest, "root is required")
		return
	}

	subPath := r.URL.Query().Get("path")

	var (
		entries  []filesystemEntry
		fullPath string
		relPath  string
		err      error
	)

	switch root {
	case "library":
		listing, svcErr := s.librarySvc.BrowseRoot(r.Context(), subPath)
		if svcErr != nil {
			err = svcErr
			break
		}
		entries = make([]filesystemEntry, len(listing.Entries))
		for i, item := range listing.Entries {
			entries[i] = filesystemEntry{Name: item.Name, Path: item.Path, IsDir: item.IsDir, FullPath: item.FullPath}
		}
		relPath = listing.Path
		fullPath = listing.FullPath
	case "import":
		listing, svcErr := s.importSvc.BrowseRoot(r.Context(), subPath)
		if svcErr != nil {
			err = svcErr
			break
		}
		entries = make([]filesystemEntry, len(listing.Entries))
		for i, item := range listing.Entries {
			entries[i] = filesystemEntry{Name: item.Name, Path: item.Path, IsDir: item.IsDir, FullPath: item.FullPath}
		}
		relPath = listing.Path
		fullPath = listing.FullPath
	default:
		respondError(w, http.StatusBadRequest, "invalid root")
		return
	}

	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"data": map[string]interface{}{
		"path":      relPath,
		"full_path": fullPath,
		"entries":   entries,
	}})
}

// handleAdminFilesystemRoots returns the configured root paths for library and import browsing.
func (s *handler) handleAdminFilesystemRoots(w http.ResponseWriter, r *http.Request) {
	data := map[string]interface{}{
		"library": s.librarySvc.GetBrowseRoot(),
		"import":  s.importSvc.GetBrowseRoot(),
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"data": data})
}

func (s *handler) handleAdminImportExecute(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FolderID       string   `json:"folder_id"`
		Selections     []string `json:"selections"`
		CustomTemplate string   `json:"custom_template,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.FolderID == "" || len(req.Selections) == 0 {
		respondError(w, http.StatusBadRequest, "folder_id and selections are required")
		return
	}

	job, err := s.importSvc.ImportSelection(r.Context(), req.FolderID, req.Selections, req.CustomTemplate)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{"data": job})
}

func (s *handler) handleAdminImportHistory(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement persistent history
	respondJSON(w, http.StatusOK, map[string]interface{}{"data": []interface{}{}})
}

func (s *handler) handleAdminImportJob(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "job_id")
	if jobID == "" {
		respondError(w, http.StatusBadRequest, "job_id is required")
		return
	}

	respondError(w, http.StatusNotFound, "job not found")
}
