package importservice

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/lore/backend/internal/models"
	"github.com/lore/backend/internal/repository"
)

// Service handles import operations from staging folders.
type Service struct {
	repo       *repository.Repository
	browseRoot string
}

// FileEntry represents a file or directory in an import folder.
type FileEntry struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	IsDir       bool   `json:"is_dir"`
	Size        int64  `json:"size,omitempty"`
	IsAudiobook bool   `json:"is_audiobook"`
}

// ImportJob represents an import operation.
type ImportJob struct {
	ID            string             `json:"id"`
	Status        string             `json:"status"`
	SourcePaths   []string           `json:"source_paths"`
	ImportedBooks []models.Audiobook `json:"imported_books"`
	Errors        []string           `json:"errors,omitempty"`
	StartedAt     time.Time          `json:"started_at"`
	CompletedAt   *time.Time         `json:"completed_at,omitempty"`
}

// Metadata represents extracted audiobook metadata.
type Metadata struct {
	Title        string
	Author       string
	Series       string
	SeriesNumber string
	Narrator     string
	Year         string
	OriginalName string
}

// NewService creates a new import service.
func NewService(repo *repository.Repository, browseRoot string) *Service {
	absRoot := browseRoot
	if abs, err := filepath.Abs(browseRoot); err == nil {
		absRoot = abs
	}

	return &Service{
		repo:       repo,
		browseRoot: absRoot,
	}
}

// GetImportFolders returns the configured import folders.
func (s *Service) ListImportFolders(ctx context.Context) ([]models.ImportFolder, error) {
	return s.repo.GetImportFolders(ctx)
}

// GetBrowseRoot returns the configured browse root path.
func (s *Service) GetBrowseRoot() string {
	return s.browseRoot
}

// GetEnabledImportFolders returns only enabled import folders for operational flows.
func (s *Service) GetEnabledImportFolders(ctx context.Context) ([]models.ImportFolder, error) {
	return s.repo.GetEnabledImportFolders(ctx)
}

// BrowseFolder lists the contents of an import folder.
func (s *Service) BrowseFolder(ctx context.Context, folderID, subPath string) ([]FileEntry, error) {
	// Validate folder ID
	folderPath, err := s.getFolderPath(ctx, folderID)
	if err != nil {
		return nil, err
	}

	// Build full path
	fullPath := filepath.Join(folderPath, subPath)

	// Ensure the path is still within the import folder (security check)
	if !strings.HasPrefix(fullPath, folderPath) {
		return nil, fmt.Errorf("invalid path: outside of import folder")
	}

	// List directory contents
	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	var files []FileEntry
	for _, entry := range entries {
		entryPath := filepath.Join(subPath, entry.Name())

		fileEntry := FileEntry{
			Name:        entry.Name(),
			Path:        entryPath,
			IsDir:       entry.IsDir(),
			IsAudiobook: s.isAudiobookCandidate(entry),
		}

		// Get file size if it's a file
		if !entry.IsDir() {
			if info, err := entry.Info(); err == nil {
				fileEntry.Size = info.Size()
			}
		}

		files = append(files, fileEntry)
	}

	return files, nil
}

// ImportSelection imports selected files/folders to the library.
func (s *Service) ImportSelection(ctx context.Context, folderID string, selections []string, customTemplate string) (*ImportJob, error) {
	// Get import settings from database
	settings, err := s.repo.GetImportSettings(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get import settings: %w", err)
	}

	// Use custom template if provided, otherwise use configured template
	template := settings.Template
	if customTemplate != "" {
		template = customTemplate
	}

	job := &ImportJob{
		ID:          uuid.NewString(),
		Status:      "processing",
		SourcePaths: selections,
		StartedAt:   time.Now(),
	}

	folderPath, err := s.getFolderPath(ctx, folderID)
	if err != nil {
		job.Status = "failed"
		job.Errors = []string{err.Error()}
		return job, err
	}

	for _, selection := range selections {
		sourcePath := filepath.Join(folderPath, selection)

		// Security check
		if !strings.HasPrefix(sourcePath, folderPath) {
			job.Errors = append(job.Errors, fmt.Sprintf("invalid path: %s", selection))
			continue
		}

		audiobook, err := s.processImport(ctx, sourcePath, template, settings.DestinationPath)
		if err != nil {
			job.Errors = append(job.Errors, fmt.Sprintf("failed to import %s: %v", selection, err))
			continue
		}

		job.ImportedBooks = append(job.ImportedBooks, *audiobook)
	}

	// Update job status
	now := time.Now()
	job.CompletedAt = &now
	if len(job.Errors) == 0 {
		job.Status = "completed"
	} else if len(job.ImportedBooks) > 0 {
		job.Status = "partial"
	} else {
		job.Status = "failed"
	}

	return job, nil
}

// processImport handles the import of a single file or directory.
func (s *Service) processImport(ctx context.Context, sourcePath, template, destinationPath string) (*models.Audiobook, error) {
	// Extract metadata
	metadata := s.extractMetadata(sourcePath)

	// Build destination path
	destPath, err := s.buildDestination(metadata, template, destinationPath)
	if err != nil {
		return nil, fmt.Errorf("failed to build destination: %w", err)
	}

	// Create destination directory
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return nil, fmt.Errorf("failed to create destination directory: %w", err)
	}

	// Copy files
	if err := s.copyRecursive(sourcePath, destPath); err != nil {
		return nil, fmt.Errorf("failed to copy files: %w", err)
	}

	// Create audiobook entry
	audiobook, err := s.createAudiobookEntry(ctx, destPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create audiobook entry: %w", err)
	}

	return audiobook, nil
}

// extractMetadata attempts to extract metadata from file/folder names.
func (s *Service) extractMetadata(path string) Metadata {
	base := filepath.Base(path)

	// Basic metadata extraction from filename/directory name
	// This is a simple implementation - could be enhanced with actual metadata reading
	metadata := Metadata{
		OriginalName: base,
		Title:        base,
		Author:       "Unknown Author",
	}

	// Try to parse common patterns
	// Pattern: "Author - Title"
	if parts := strings.Split(base, " - "); len(parts) >= 2 {
		metadata.Author = strings.TrimSpace(parts[0])
		metadata.Title = strings.TrimSpace(strings.Join(parts[1:], " - "))
	}

	// Pattern: "Author_Title" or "Author Title"
	if strings.Contains(base, "_") {
		parts := strings.Split(base, "_")
		if len(parts) >= 2 {
			metadata.Author = strings.TrimSpace(parts[0])
			metadata.Title = strings.TrimSpace(strings.Join(parts[1:], " "))
		}
	}

	return metadata
}

// buildDestination creates the destination path based on the template.
func (s *Service) buildDestination(metadata Metadata, template, destinationPath string) (string, error) {
	if template == "flat" {
		return filepath.Join(destinationPath, metadata.OriginalName), nil
	}

	path := template

	// Replace template tokens
	replacements := map[string]string{
		"{author}":     sanitizePath(valueOrDefault(metadata.Author, "Unknown Author")),
		"{title}":      sanitizePath(valueOrDefault(metadata.Title, "Unknown Title")),
		"{series}":     sanitizePath(metadata.Series),
		"{series_num}": metadata.SeriesNumber,
		"{narrator}":   sanitizePath(metadata.Narrator),
		"{year}":       metadata.Year,
	}

	for token, value := range replacements {
		path = strings.ReplaceAll(path, token, value)
	}

	// Clean up any empty segments
	path = strings.ReplaceAll(path, "//", "/")
	path = strings.Trim(path, "/")

	return filepath.Join(destinationPath, path), nil
}

// copyRecursive copies a file or directory recursively.
func (s *Service) copyRecursive(src, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if srcInfo.IsDir() {
		return s.copyDirectory(src, dst)
	}
	return s.copyFile(src, dst)
}

// copyDirectory copies a directory and all its contents.
func (s *Service) copyDirectory(src, dst string) error {
	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			if err := s.copyDirectory(srcPath, dstPath); err != nil {
				return err
			}
		} else {
			if err := s.copyFile(srcPath, dstPath); err != nil {
				return err
			}
		}
	}

	return nil
}

// copyFile copies a single file.
func (s *Service) copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	if err != nil {
		return err
	}

	// Copy file permissions
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	return os.Chmod(dst, srcInfo.Mode())
}

// createAudiobookEntry creates a database entry for the imported audiobook.
func (s *Service) createAudiobookEntry(ctx context.Context, assetPath string) (*models.Audiobook, error) {
	// Discover media files
	mediaFiles, err := s.discoverMediaFiles(assetPath)
	if err != nil {
		return nil, err
	}

	if len(mediaFiles) == 0 {
		return nil, fmt.Errorf("no audio files found in %s", assetPath)
	}

	// Find which library path contains this asset
	libraryPathID, err := s.findLibraryPathForAsset(ctx, assetPath)
	if err != nil {
		return nil, fmt.Errorf("failed to find library path for asset: %w", err)
	}

	pathConfig, err := s.repo.GetLibraryPathByID(ctx, libraryPathID)
	if err != nil {
		return nil, fmt.Errorf("failed to load library path configuration: %w", err)
	}
	var libraryIDPtr *string
	if len(pathConfig.Libraries) > 0 {
		libID := pathConfig.Libraries[0].ID
		libraryIDPtr = &libID
	}
	if libraryIDPtr == nil {
		return nil, fmt.Errorf("library path %s is not assigned to a library", pathConfig.Name)
	}

	// Create audiobook
	audiobook := &models.Audiobook{
		ID:            uuid.NewString(),
		LibraryID:     libraryIDPtr,
		LibraryPathID: libraryPathID,
		AssetPath:     assetPath,
	}

	// Set audiobook ID on media files
	for i := range mediaFiles {
		mediaFiles[i].AudiobookID = audiobook.ID
	}

	// Create in database
	if err := s.repo.CreateAudiobook(ctx, audiobook, mediaFiles, ""); err != nil {
		return nil, err
	}

	// Fetch the created audiobook with stats
	return s.repo.GetAudiobook(ctx, audiobook.ID, "")
}

// discoverMediaFiles finds audio files in the given directory.
func (s *Service) discoverMediaFiles(assetPath string) ([]models.MediaFile, error) {
	var mediaFiles []models.MediaFile

	err := filepath.WalkDir(assetPath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // Skip problematic paths
		}

		if d.IsDir() {
			return nil
		}

		if !isAudioFile(path) {
			return nil
		}

		rel, err := filepath.Rel(assetPath, path)
		if err != nil {
			rel = filepath.Base(path)
		}

		mediaFile := models.MediaFile{
			ID:          uuid.NewString(),
			Filename:    rel,
			DurationSec: 0, // TODO: Extract duration using ffprobe
			MimeType:    getMimeType(path),
		}

		mediaFiles = append(mediaFiles, mediaFile)
		return nil
	})

	return mediaFiles, err
}

// getFolderPath returns the full path for a folder ID.
func (s *Service) getFolderPath(ctx context.Context, folderID string) (string, error) {
	folder, err := s.repo.GetImportFolderByID(ctx, folderID)
	if err != nil {
		return "", fmt.Errorf("failed to get import folder: %w", err)
	}

	if !folder.Enabled {
		return "", fmt.Errorf("import folder disabled: %s", folder.Name)
	}

	return folder.Path, nil
}

// Import Folder Management Methods

// findLibraryPathForAsset finds which library path contains the given asset path.
func (s *Service) findLibraryPathForAsset(ctx context.Context, assetPath string) (string, error) {
	// Get all library paths
	libraryPaths, err := s.repo.GetLibraryPaths(ctx)
	if err != nil {
		return "", err
	}

	// Find the library path that contains this asset
	for _, lp := range libraryPaths {
		if strings.HasPrefix(assetPath, lp.Path) {
			return lp.ID, nil
		}
	}

	return "", fmt.Errorf("no library path found that contains asset path: %s", assetPath)
}

// CreateImportFolder adds a new import folder configuration.
func (s *Service) CreateImportFolder(ctx context.Context, importFolder *models.ImportFolder) error {
	return s.repo.CreateImportFolder(ctx, importFolder)
}

// UpdateImportFolder updates an existing import folder.
func (s *Service) UpdateImportFolder(ctx context.Context, id string, updates map[string]interface{}) error {
	return s.repo.UpdateImportFolder(ctx, id, updates)
}

// DeleteImportFolder removes an import folder configuration.
func (s *Service) DeleteImportFolder(ctx context.Context, id string) error {
	return s.repo.DeleteImportFolder(ctx, id)
}

// DirectoryEntry represents a directory exposed under the import browse root.
type DirectoryEntry struct {
	Name     string
	Path     string
	FullPath string
	IsDir    bool
}

type DirectoryListing struct {
	Path     string
	FullPath string
	Entries  []DirectoryEntry
}

// BrowseRoot lists directories under the configured import browse root.
func (s *Service) BrowseRoot(ctx context.Context, child string) (DirectoryListing, error) {
	listing := DirectoryListing{}
	if s.browseRoot == "" {
		return listing, fmt.Errorf("import browse root not configured")
	}

	target, rel, err := importResolveWithinRoot(s.browseRoot, child)
	if err != nil {
		return listing, err
	}

	normalized := filepath.ToSlash(filepath.Clean(rel))
	if normalized == "." {
		normalized = ""
	}

	entries, err := os.ReadDir(target)
	if err != nil {
		return listing, fmt.Errorf("read directory: %w", err)
	}

	var result []DirectoryEntry
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		relPath := filepath.Join(filepath.FromSlash(normalized), entry.Name())
		relPath = filepath.Clean(relPath)
		relPath = filepath.ToSlash(relPath)
		absPath := filepath.Join(target, entry.Name())
		absPath = filepath.Clean(absPath)
		absPath = filepath.ToSlash(absPath)

		result = append(result, DirectoryEntry{
			Name:     entry.Name(),
			Path:     relPath,
			FullPath: absPath,
			IsDir:    true,
		})
	}

	listing.Path = normalized
	listing.FullPath = filepath.ToSlash(filepath.Clean(target))
	listing.Entries = result

	return listing, nil
}

func importResolveWithinRoot(root, child string) (string, string, error) {
	root, err := filepath.Abs(root)
	if err != nil {
		return "", "", fmt.Errorf("resolve root: %w", err)
	}

	sub := filepath.Clean(filepath.FromSlash(child))
	if sub == "." || sub == "" {
		return root, "", nil
	}

	target := filepath.Join(root, sub)
	target = filepath.Clean(target)

	rel, err := filepath.Rel(root, target)
	if err != nil {
		return "", "", fmt.Errorf("resolve path: %w", err)
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", "", fmt.Errorf("path escapes root")
	}

	return target, rel, nil
}

// GetImportSettings returns the persisted import settings.
func (s *Service) GetImportSettings(ctx context.Context) (*models.ImportSettings, error) {
	return s.repo.GetImportSettings(ctx)
}

// UpdateImportSettings persists the provided import settings.
func (s *Service) UpdateImportSettings(ctx context.Context, settings *models.ImportSettings) error {
	return s.repo.UpdateImportSettings(ctx, settings)
}

// isAudiobookCandidate checks if a file/directory might be an audiobook.
func (s *Service) isAudiobookCandidate(entry os.DirEntry) bool {
	if entry.IsDir() {
		return true // Directories might contain audiobooks
	}

	return isAudioFile(entry.Name())
}

// Helper functions

// isAudioFile checks if a file is an audio file based on extension.
func isAudioFile(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	audioExts := []string{".mp3", ".m4a", ".m4b", ".flac", ".wav", ".ogg", ".aac"}

	for _, audioExt := range audioExts {
		if ext == audioExt {
			return true
		}
	}
	return false
}

// getMimeType returns the MIME type for an audio file.
func getMimeType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".mp3":
		return "audio/mpeg"
	case ".m4a", ".m4b":
		return "audio/mp4"
	case ".flac":
		return "audio/flac"
	case ".wav":
		return "audio/wav"
	case ".ogg":
		return "audio/ogg"
	case ".aac":
		return "audio/aac"
	default:
		return "audio/mpeg"
	}
}

// sanitizePath sanitizes a string for use in file paths.
func sanitizePath(s string) string {
	// Remove or replace problematic characters
	s = strings.ReplaceAll(s, "/", "-")
	s = strings.ReplaceAll(s, "\\", "-")
	s = strings.ReplaceAll(s, ":", "-")
	s = strings.ReplaceAll(s, "*", "-")
	s = strings.ReplaceAll(s, "?", "-")
	s = strings.ReplaceAll(s, "\"", "-")
	s = strings.ReplaceAll(s, "<", "-")
	s = strings.ReplaceAll(s, ">", "-")
	s = strings.ReplaceAll(s, "|", "-")

	// Trim whitespace
	s = strings.TrimSpace(s)

	// Replace multiple consecutive dashes with single dash
	for strings.Contains(s, "--") {
		s = strings.ReplaceAll(s, "--", "-")
	}

	return s
}

// valueOrDefault returns the value if not empty, otherwise returns the default.
func valueOrDefault(value, defaultValue string) string {
	if strings.TrimSpace(value) == "" {
		return defaultValue
	}
	return value
}
