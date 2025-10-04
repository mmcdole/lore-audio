package library

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/lore/backend/internal/models"
	"github.com/lore/backend/internal/repository"
)

// Service handles library management operations.
type Service struct {
	repo       *repository.Repository
	browseRoot string
}

// LibraryInfo contains information about a library path.
type LibraryInfo struct {
	Path        string     `json:"path"`
	BookCount   int        `json:"book_count"`
	LastScanned *time.Time `json:"last_scanned,omitempty"`
}

// ScanResult contains the results of a library scan.
type DirectoryScanResult struct {
	DirectoryID   string             `json:"directory_id"`
	DirectoryPath string             `json:"directory_path"`
	BooksFound    int                `json:"books_found"`
	NewBooks      []models.Audiobook `json:"new_books"`
	ScanDuration  string             `json:"scan_duration"`
}

type ScanResult struct {
	LibraryID     string                `json:"library_id"`
	LibraryName   string                `json:"library_name"`
	Directories   []DirectoryScanResult `json:"directories"`
	TotalBooks    int                   `json:"total_books_found"`
	TotalNewBooks int                   `json:"total_new_books"`
	ScanDuration  string                `json:"scan_duration"`
}

// NewService creates a new library service.
func NewService(repo *repository.Repository, browseRoot string) *Service {
	absRoot := browseRoot
	if abs, err := filepath.Abs(browseRoot); err == nil {
		tmp := abs
		absRoot = tmp
	}

	return &Service{
		repo:       repo,
		browseRoot: absRoot,
	}
}

// GetLibraries returns information about all configured libraries including directories.
func (s *Service) GetLibraries(ctx context.Context) ([]models.Library, error) {
	return s.repo.ListLibraries(ctx)
}

// GetBrowseRoot returns the configured browse root path.
func (s *Service) GetBrowseRoot() string {
	return s.browseRoot
}

// ListLibraryPaths returns all configured library paths regardless of status.
func (s *Service) ListLibraryPaths(ctx context.Context) ([]models.LibraryPath, error) {
	return s.repo.GetLibraryPaths(ctx)
}

// ScanLibrary scans all directories assigned to a library for new audiobooks.
func (s *Service) ScanLibrary(ctx context.Context, libraryID string) (*ScanResult, error) {
	library, err := s.repo.GetLibraryByID(ctx, libraryID)
	if err != nil {
		return nil, fmt.Errorf("library lookup failed: %w", err)
	}

	startTime := time.Now()
	result := &ScanResult{
		LibraryID:   library.ID,
		LibraryName: library.DisplayName,
	}

	for _, directory := range library.Directories {
		if !directory.Enabled {
			continue
		}

		dir := directory // copy to avoid referencing loop variable
		dirResult, err := s.scanLibraryPath(ctx, library.ID, &dir)
		if err != nil {
			fmt.Printf("Failed to scan directory %s for library %s: %v\n", dir.Path, library.DisplayName, err)
			continue
		}

		result.Directories = append(result.Directories, *dirResult)
		result.TotalBooks += dirResult.BooksFound
		result.TotalNewBooks += len(dirResult.NewBooks)
	}

	result.ScanDuration = time.Since(startTime).String()
	return result, nil
}

func (s *Service) scanLibraryPath(ctx context.Context, libraryID string, pathConfig *models.LibraryPath) (*DirectoryScanResult, error) {
	startTime := time.Now()

	discoveries, err := s.discoverAudiobooks(pathConfig.Path)
	if err != nil {
		return nil, fmt.Errorf("failed to discover audiobooks: %w", err)
	}

	fmt.Printf("Discovered %d audiobooks in %s\n", len(discoveries), pathConfig.Path)
	for i, d := range discoveries {
		fmt.Printf("  Discovery %d: %s with %d files\n", i+1, d.AssetPath, len(d.MediaFiles))
	}

	var newBooks []models.Audiobook
	for _, discovery := range discoveries {
		existing, err := s.repo.GetAudiobookByPath(ctx, discovery.AssetPath)
		if err == nil && existing != nil {
			fmt.Printf("Audiobook already exists at %s, skipping\n", discovery.AssetPath)
			continue
		}

		libID := libraryID
		audiobook := &models.Audiobook{
			ID:            uuid.NewString(),
			LibraryID:     &libID,
			LibraryPathID: pathConfig.ID,
			AssetPath:     discovery.AssetPath,
		}

		fmt.Printf("Creating audiobook with library_id=%s library_path_id=%s for path=%s\n", libraryID, pathConfig.ID, discovery.AssetPath)

		for i := range discovery.MediaFiles {
			if discovery.MediaFiles[i].AudiobookID == "" {
				discovery.MediaFiles[i].AudiobookID = audiobook.ID
			}
		}

		if err := s.repo.CreateAudiobook(ctx, audiobook, discovery.MediaFiles, ""); err != nil {
			fmt.Printf("Failed to create audiobook at %s for library %s: %v\n", discovery.AssetPath, libraryID, err)
			continue
		}

		created, err := s.repo.GetAudiobook(ctx, audiobook.ID, "")
		if err != nil {
			continue
		}

		newBooks = append(newBooks, *created)
	}

	return &DirectoryScanResult{
		DirectoryID:   pathConfig.ID,
		DirectoryPath: pathConfig.Path,
		BooksFound:    len(discoveries),
		NewBooks:      newBooks,
		ScanDuration:  time.Since(startTime).String(),
	}, nil
}

// ScanAllLibraries scans all libraries and aggregates their results.
func (s *Service) ScanAllLibraries(ctx context.Context) ([]ScanResult, error) {
	libraries, err := s.repo.ListLibraries(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list libraries: %w", err)
	}

	var results []ScanResult
	for _, library := range libraries {
		result, err := s.ScanLibrary(ctx, library.ID)
		if err != nil {
			fmt.Printf("Failed to scan library %s: %v\n", library.DisplayName, err)
			continue
		}
		results = append(results, *result)
	}

	return results, nil
}

// GetLibrary fetches a library by identifier.
func (s *Service) GetLibrary(ctx context.Context, id string) (*models.Library, error) {
	return s.repo.GetLibraryByID(ctx, id)
}

// CreateLibrary registers a new library with optional directories.
func (s *Service) CreateLibrary(ctx context.Context, library *models.Library) (*models.Library, error) {
	if library == nil {
		return nil, fmt.Errorf("library payload required")
	}

	if strings.TrimSpace(library.DisplayName) == "" {
		return nil, fmt.Errorf("display_name is required")
	}

	if strings.TrimSpace(library.Name) == "" {
		library.Name = generateLibraryName(library.DisplayName)
	}

	if library.ID == "" {
		library.ID = uuid.NewString()
	}

	if strings.TrimSpace(library.Type) == "" {
		library.Type = "audiobook"
	}

	if err := s.repo.CreateLibrary(ctx, library); err != nil {
		return nil, err
	}

	return s.repo.GetLibraryByID(ctx, library.ID)
}

// UpdateLibrary applies partial updates to a library record.
func (s *Service) UpdateLibrary(ctx context.Context, id string, updates map[string]interface{}) (*models.Library, error) {
	if updates == nil {
		updates = map[string]interface{}{}
	}

	if settings, ok := updates["settings"]; ok {
		switch value := settings.(type) {
		case map[string]interface{}:
			updates["settings"] = cloneSettings(value)
		case *map[string]interface{}:
			if value != nil {
				cloned := cloneSettings(*value)
				updates["settings"] = cloned
			}
		}
	}

	if err := s.repo.UpdateLibrary(ctx, id, updates); err != nil {
		return nil, err
	}

	return s.repo.GetLibraryByID(ctx, id)
}

// DeleteLibrary removes a library and any associated assignments.
func (s *Service) DeleteLibrary(ctx context.Context, id string) error {
	return s.repo.DeleteLibrary(ctx, id)
}

// SetLibraryDirectories updates the directories assigned to a library.
func (s *Service) SetLibraryDirectories(ctx context.Context, libraryID string, directoryIDs []string) (*models.Library, error) {
	if err := s.repo.SetLibraryDirectories(ctx, libraryID, directoryIDs); err != nil {
		return nil, err
	}

	return s.repo.GetLibraryByID(ctx, libraryID)
}

func cloneSettings(src map[string]interface{}) map[string]interface{} {
	if src == nil {
		return nil
	}

	clone := make(map[string]interface{}, len(src))
	for k, v := range src {
		clone[k] = v
	}
	return clone
}

func generateLibraryName(displayName string) string {
	slug := strings.ToLower(strings.TrimSpace(displayName))
	re := regexp.MustCompile(`[^a-z0-9]+`)
	slug = re.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		return uuid.NewString()
	}
	return slug
}

// DirectoryEntry represents a filesystem entry available under the configured root.
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

// BrowseRoot lists directories under the configured browse root constrained to the root boundary.
func (s *Service) BrowseRoot(ctx context.Context, child string) (DirectoryListing, error) {
	listing := DirectoryListing{}
	if s.browseRoot == "" {
		return listing, fmt.Errorf("library browse root not configured")
	}

	target, rel, err := resolveWithinRoot(s.browseRoot, child)
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

func resolveWithinRoot(root, child string) (string, string, error) {
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

// AudiobookDiscovery represents a discovered audiobook.
type AudiobookDiscovery struct {
	AssetPath  string
	MediaFiles []models.MediaFile
}

// discoverAudiobooks finds audiobooks in a library path.
func (s *Service) discoverAudiobooks(libraryPath string) ([]AudiobookDiscovery, error) {
	var discoveries []AudiobookDiscovery

	// First, handle individual audio files in the library root
	rootEntries, err := os.ReadDir(libraryPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read library path: %w", err)
	}

	for _, entry := range rootEntries {
		if entry.IsDir() {
			continue // Skip directories in this pass
		}

		fullPath := filepath.Join(libraryPath, entry.Name())
		if isAudioFile(fullPath) {
			// Individual file in root becomes its own audiobook
			discovery := AudiobookDiscovery{
				AssetPath: fullPath, // Use full file path as unique identifier
				MediaFiles: []models.MediaFile{
					{
						ID:          uuid.NewString(),
						AudiobookID: "", // Will be set when creating audiobook
						Filename:    entry.Name(),
						DurationSec: 0, // TODO: Extract duration
						MimeType:    getMimeType(fullPath),
					},
				},
			}
			discoveries = append(discoveries, discovery)
		}
	}

	// Now handle directories as books
	for _, entry := range rootEntries {
		if !entry.IsDir() {
			continue // Skip files in this pass
		}

		dirPath := filepath.Join(libraryPath, entry.Name())

		// Check if directory contains audio files
		mediaFiles, err := s.findMediaFilesInDir(dirPath)
		if err != nil || len(mediaFiles) == 0 {
			// If no audio files directly in this directory, check subdirectories
			err := filepath.WalkDir(dirPath, func(path string, d os.DirEntry, err error) error {
				if err != nil {
					return nil // Skip problematic paths
				}

				// Skip the root directory itself
				if path == dirPath {
					return nil
				}

				if d.IsDir() {
					// Check if this subdirectory has audio files
					subMediaFiles, err := s.findMediaFilesInDir(path)
					if err == nil && len(subMediaFiles) > 0 {
						discovery := AudiobookDiscovery{
							AssetPath:  path,
							MediaFiles: subMediaFiles,
						}
						discoveries = append(discoveries, discovery)
						return filepath.SkipDir // Don't go deeper
					}
				}

				return nil
			})
			if err != nil {
				fmt.Printf("Error walking directory %s: %v\n", dirPath, err)
			}
		} else {
			// Directory has audio files directly in it
			discovery := AudiobookDiscovery{
				AssetPath:  dirPath,
				MediaFiles: mediaFiles,
			}
			discoveries = append(discoveries, discovery)
		}
	}

	return discoveries, nil
}

// findMediaFilesInDir finds all audio files in a directory.
func (s *Service) findMediaFilesInDir(dirPath string) ([]models.MediaFile, error) {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, err
	}

	var mediaFiles []models.MediaFile

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		fullPath := filepath.Join(dirPath, entry.Name())
		if !isAudioFile(fullPath) {
			continue
		}

		rel, err := filepath.Rel(dirPath, fullPath)
		if err != nil {
			rel = entry.Name()
		}

		mediaFile := models.MediaFile{
			ID:          uuid.NewString(),
			AudiobookID: "", // Will be set when creating audiobook
			Filename:    rel,
			DurationSec: 0, // TODO: Extract duration
			MimeType:    getMimeType(fullPath),
		}

		mediaFiles = append(mediaFiles, mediaFile)
	}

	return mediaFiles, nil
}

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
		return "audio/mpeg" // Default fallback
	}
}

// Library Path Management

// CreateLibraryPath adds a new library path.
func (s *Service) CreateLibraryPath(ctx context.Context, path, name string) (*models.LibraryPath, error) {
	libraryPath := &models.LibraryPath{
		ID:      uuid.NewString(),
		Path:    path,
		Name:    name,
		Enabled: true,
	}

	if err := s.repo.CreateLibraryPath(ctx, libraryPath); err != nil {
		return nil, err
	}

	return libraryPath, nil
}

// UpdateLibraryPath updates an existing library path.
func (s *Service) UpdateLibraryPath(ctx context.Context, id string, updates map[string]interface{}) error {
	return s.repo.UpdateLibraryPath(ctx, id, updates)
}

// DeleteLibraryPath removes a library path.
func (s *Service) DeleteLibraryPath(ctx context.Context, id string) error {
	return s.repo.DeleteLibraryPath(ctx, id)
}

// UpdateLastScanned updates the last scanned timestamp for a library path.
func (s *Service) UpdateLastScanned(ctx context.Context, libraryPath string) error {
	// Find the library path by path
	paths, err := s.repo.GetLibraryPaths(ctx)
	if err != nil {
		return err
	}

	for _, path := range paths {
		if path.Path == libraryPath {
			now := time.Now()
			updates := map[string]interface{}{
				"last_scanned_at": now,
			}
			return s.repo.UpdateLibraryPath(ctx, path.ID, updates)
		}
	}

	return fmt.Errorf("library path not found: %s", libraryPath)
}
