package audiobooks

import (
	"context"
	"encoding/json"
	"fmt"
	"mime"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/flix-audio/backend/internal/library"
	"github.com/flix-audio/backend/internal/metadata"
	"github.com/flix-audio/backend/internal/models"
	"github.com/flix-audio/backend/internal/providers"
	"github.com/flix-audio/backend/internal/repository"
)

// Service coordinates media storage, metadata, and persistence for audiobooks.
type Service struct {
	repo         *repository.Repository
	metadataProv metadata.Provider
}

// New creates a new Service.
func New(repo *repository.Repository, provider metadata.Provider) *Service {
	if provider == nil {
		provider = metadata.NoopProvider{}
	}
	return &Service{
		repo:         repo,
		metadataProv: provider,
	}
}

// LibraryScan lists the entries in the source library directory.
// DEPRECATED: Use library service instead
func (s *Service) LibraryScan() ([]library.Entry, error) {
	return nil, fmt.Errorf("library scanning moved to library service")
}

// CreateFromSource ingests a new audiobook from a file or directory (admin only).
func (s *Service) CreateFromSource(ctx context.Context, sourcePath string) (*models.Audiobook, error) {
	if strings.TrimSpace(sourcePath) == "" {
		return nil, fmt.Errorf("source path is required")
	}

	candidate := filepath.Clean(filepath.FromSlash(sourcePath))

	// DEPRECATED: Direct path access instead of scanner
	// Just use the source path directly for now
	absRoot := filepath.Dir(candidate)
	if evalRoot, err := filepath.EvalSymlinks(absRoot); err == nil {
		absRoot = evalRoot
	}

	var absSource string
	if filepath.IsAbs(candidate) {
		absSource = candidate
	} else {
		absSource = filepath.Join(absRoot, candidate)
	}

	var err error
	absSource, err = filepath.Abs(absSource)
	if err != nil {
		return nil, fmt.Errorf("could not resolve absolute source path: %w", err)
	}

	resolvedSource := absSource
	if evalSource, err := filepath.EvalSymlinks(absSource); err == nil {
		resolvedSource = evalSource
	} else if !os.IsNotExist(err) {
		return nil, fmt.Errorf("source not accessible: %w", err)
	}

	relToRoot, err := filepath.Rel(absRoot, resolvedSource)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve source path: %w", err)
	}
	if relToRoot == ".." || strings.HasPrefix(relToRoot, ".."+string(os.PathSeparator)) {
		return nil, fmt.Errorf("source path must reside within the library root")
	}

	if _, err := os.Stat(resolvedSource); err != nil {
		return nil, fmt.Errorf("source not accessible: %w", err)
	}

	audiobookID := uuid.NewString()
	assetPath, assetFiles, err := discoverMediaFiles(resolvedSource)
	if err != nil {
		return nil, err
	}

	libraryPathID, libraryID, err := s.resolveLibraryForAsset(ctx, assetPath)
	if err != nil {
		return nil, err
	}

	media := make([]models.MediaFile, 0, len(assetFiles))
	for _, file := range assetFiles {
		// Extract duration from the audio file
		fullPath := filepath.Join(assetPath, file.Path)
		duration, err := s.extractAudioDuration(fullPath)
		if err != nil {
			// Log the error but continue with 0 duration rather than failing the entire import
			fmt.Printf("Warning: Failed to extract duration for %s: %v\n", fullPath, err)
			duration = 0
		}

		media = append(media, models.MediaFile{
			ID:          uuid.NewString(),
			AudiobookID: audiobookID,
			Filename:    file.Path,
			DurationSec: duration,
			MimeType:    file.MimeType,
		})
	}

	audiobook := &models.Audiobook{
		ID:            audiobookID,
		LibraryID:     &libraryID,
		LibraryPathID: libraryPathID,
		AssetPath:     assetPath,
	}

	// For creation, we don't create user data - users add to library manually
	if err := s.repo.CreateAudiobook(ctx, audiobook, media, ""); err != nil {
		return nil, err
	}

	// Return without user-specific data for admin creation
	return s.repo.GetAudiobook(ctx, audiobookID, "")
}

// Delete removes the audiobook records while leaving source files untouched (admin only).
func (s *Service) Delete(ctx context.Context, id string) error {
	if _, err := s.repo.GetAudiobook(ctx, id, ""); err != nil {
		return err
	}

	return s.repo.DeleteAudiobook(ctx, id)
}

// SearchMetadata searches for audiobook metadata using external providers
func (s *Service) SearchMetadata(ctx context.Context, providerName, title, author string) ([]providers.SearchResult, error) {
	provider := s.getProvider(providerName)
	if provider == nil {
		return nil, fmt.Errorf("unknown provider: %s", providerName)
	}

	return provider.Search(ctx, title, author)
}

// LinkMetadata links an audiobook to external metadata by fetching and saving it
func (s *Service) LinkMetadata(ctx context.Context, audiobookID, providerName, externalID string) error {
	provider := s.getProvider(providerName)
	if provider == nil {
		return fmt.Errorf("unknown provider: %s", providerName)
	}

	// Fetch metadata from provider
	result, err := provider.GetByID(ctx, externalID)
	if err != nil {
		return fmt.Errorf("failed to fetch metadata: %w", err)
	}

	// Convert SearchResult to AgentMetadata
	agentMetadata := s.convertSearchResultToAgentMetadata(result)

	// Save or update the agent metadata
	if err := s.repo.UpsertAgentMetadata(ctx, agentMetadata); err != nil {
		return fmt.Errorf("failed to save agent metadata: %w", err)
	}

	// Link the audiobook to this metadata
	if err := s.repo.LinkAudiobookMetadata(ctx, audiobookID, agentMetadata.ID); err != nil {
		return fmt.Errorf("failed to link metadata: %w", err)
	}

	return nil
}

// getProvider returns the appropriate metadata provider based on name
func (s *Service) getProvider(name string) providers.Provider {
	switch name {
	case "audible":
		return providers.NewAudibleProvider("us", nil)
	case "google":
		return providers.NewGoogleBooksProvider(nil)
	default:
		return nil
	}
}

// convertSearchResultToAgentMetadata converts a provider SearchResult to AgentMetadata
func (s *Service) convertSearchResultToAgentMetadata(result *providers.SearchResult) *models.AgentMetadata {
	// Generate ID from provider and external_id
	metadataID := fmt.Sprintf("%s:%s", result.Provider, result.ExternalID)

	now := time.Now().UTC()

	// Build series info from series name and sequence as JSON
	var seriesInfo *string
	if result.SeriesName != nil {
		seriesData := map[string]string{
			"name": *result.SeriesName,
		}
		if result.SeriesSequence != nil {
			seriesData["sequence"] = *result.SeriesSequence
		}
		if data, err := json.Marshal(seriesData); err == nil {
			str := string(data)
			seriesInfo = &str
		}
	}

	// Convert genres slice to JSON string
	var genresJSON *string
	if len(result.Genres) > 0 {
		if data, err := json.Marshal(result.Genres); err == nil {
			str := string(data)
			genresJSON = &str
		}
	}

	return &models.AgentMetadata{
		ID:          metadataID,
		Title:       result.Title,
		Subtitle:    result.Subtitle,
		Author:      result.Author,
		Narrator:    result.Narrator,
		Description: result.Description,
		CoverURL:    result.CoverURL,
		SeriesInfo:  seriesInfo,
		ReleaseDate: result.PublishedYear,
		ISBN:        result.ISBN,
		ASIN:        result.ASIN,
		Language:    result.Language,
		Publisher:   result.Publisher,
		DurationSec: result.DurationMin,
		Rating:      result.Rating,
		Genres:      genresJSON,
		Source:      result.Provider,
		ExternalID:  &result.ExternalID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// UnlinkMetadata clears the metadata association (admin only).
func (s *Service) UnlinkMetadata(ctx context.Context, audiobookID string) (*models.Audiobook, error) {
	if err := s.repo.UnlinkAudiobookMetadata(ctx, audiobookID); err != nil {
		return nil, err
	}
	return s.repo.GetAudiobook(ctx, audiobookID, "")
}

// MediaFileStream resolves the on-disk path and mime type for a media file ID.
// It validates the path to prevent directory traversal attacks.
func (s *Service) MediaFileStream(ctx context.Context, fileID string, userID string, isAdmin bool) (string, string, error) {
	media, audiobook, err := s.repo.GetMediaFileWithAudiobook(ctx, fileID)
	if err != nil {
		return "", "", err
	}

	// Authorization check: user must have this audiobook in their library (or be admin)
	if !isAdmin {
		hasAccess, err := s.repo.UserHasAudiobookInLibrary(ctx, userID, audiobook.ID)
		if err != nil {
			return "", "", fmt.Errorf("authorization check failed: %w", err)
		}
		if !hasAccess {
			return "", "", fmt.Errorf("user does not have access to this audiobook")
		}
	}

	base := audiobook.AssetPath
	if base == "" {
		return "", "", fmt.Errorf("audiobook %s has no asset path", audiobook.ID)
	}

	// Resolve the base path to guard against symlinks escaping the asset root.
	if !filepath.IsAbs(base) {
		absBase, err := filepath.Abs(base)
		if err != nil {
			return "", "", fmt.Errorf("could not resolve absolute path for %s: %w", base, err)
		}
		base = absBase
	}
	if evalBase, err := filepath.EvalSymlinks(base); err == nil {
		base = evalBase
	}

	cleanFilename := filepath.Clean(filepath.FromSlash(media.Filename))
	if cleanFilename == "" || cleanFilename == "." {
		return "", "", fmt.Errorf("invalid filename: empty path")
	}
	if filepath.IsAbs(cleanFilename) {
		return "", "", fmt.Errorf("invalid filename: absolute paths not allowed")
	}
	if cleanFilename == ".." || strings.HasPrefix(cleanFilename, ".."+string(os.PathSeparator)) {
		return "", "", fmt.Errorf("invalid filename: directory traversal not allowed")
	}

	fullPath := filepath.Join(base, cleanFilename)
	resolvedFull := fullPath
	if evalFull, err := filepath.EvalSymlinks(fullPath); err == nil {
		resolvedFull = evalFull
	} else if !os.IsNotExist(err) {
		return "", "", fmt.Errorf("failed to resolve media path: %w", err)
	}

	rel, err := filepath.Rel(base, resolvedFull)
	if err != nil {
		return "", "", fmt.Errorf("failed to resolve media path: %w", err)
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", "", fmt.Errorf("path traversal detected: file outside asset directory")
	}

	// Additional security: check if file exists and is a regular file
	info, err := os.Stat(resolvedFull)
	if err != nil {
		if os.IsNotExist(err) {
			return "", "", fmt.Errorf("media file not found on disk")
		}
		return "", "", fmt.Errorf("file access error: %w", err)
	}

	if info.IsDir() {
		return "", "", fmt.Errorf("path resolves to directory, not file")
	}

	return resolvedFull, media.MimeType, nil
}

// ListLibraryBooks returns all audiobooks in the specified library with pagination and user data attached.
func (s *Service) ListLibraryBooks(ctx context.Context, userID, libraryID string, offset, limit int) ([]models.Audiobook, int, error) {
	trimmed := strings.TrimSpace(libraryID)
	if trimmed == "" {
		return nil, 0, fmt.Errorf("library_id is required")
	}
	return s.repo.ListAudiobooks(ctx, userID, &trimmed, offset, limit)
}

// SearchLibraryBooks searches a single library for audiobooks by title, author, or narrator.
func (s *Service) SearchLibraryBooks(ctx context.Context, userID, libraryID, query string, offset, limit int) ([]models.Audiobook, int, error) {
	trimmed := strings.TrimSpace(libraryID)
	if trimmed == "" {
		return nil, 0, fmt.Errorf("library_id is required")
	}
	return s.repo.SearchAudiobooks(ctx, userID, query, &trimmed, offset, limit)
}

// extractAudioDuration uses ffprobe to get the duration of an audio file in seconds.
func (s *Service) extractAudioDuration(filePath string) (float64, error) {
	// Try ffprobe first (preferred)
	cmd := exec.Command("ffprobe",
		"-v", "quiet",
		"-show_entries", "format=duration",
		"-of", "csv=p=0",
		filePath)

	output, err := cmd.Output()
	if err == nil {
		durationStr := strings.TrimSpace(string(output))
		if duration, parseErr := strconv.ParseFloat(durationStr, 64); parseErr == nil {
			return duration, nil
		}
	}

	// Fallback: Try ffprobe with JSON output
	cmd = exec.Command("ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		filePath)

	output, err = cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("failed to extract duration with ffprobe: %w", err)
	}

	var info struct {
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}

	if err := json.Unmarshal(output, &info); err != nil {
		return 0, fmt.Errorf("failed to parse ffprobe output: %w", err)
	}

	duration, err := strconv.ParseFloat(info.Format.Duration, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse duration value: %w", err)
	}

	return duration, nil
}

// GetLibraryBook returns a single audiobook from the library catalog and verifies membership when possible.
func (s *Service) GetLibraryBook(ctx context.Context, libraryID, audiobookID, userID string) (*models.Audiobook, error) {
	book, err := s.repo.GetAudiobook(ctx, audiobookID, userID)
	if err != nil {
		return nil, err
	}
	if book.LibraryID != nil && strings.TrimSpace(libraryID) != "" && *book.LibraryID != strings.TrimSpace(libraryID) {
		return nil, fmt.Errorf("audiobook not found in library %s", libraryID)
	}
	return book, nil
}

// ListUserLibrary returns audiobooks in a user's personal library with pagination.
func (s *Service) ListUserLibrary(ctx context.Context, userID, libraryID string, offset, limit int) ([]models.Audiobook, int, error) {
	var libraryRef *string
	if trimmed := strings.TrimSpace(libraryID); trimmed != "" {
		libraryRef = &trimmed
	}
	return s.repo.ListAudiobooks(ctx, userID, libraryRef, offset, limit)
}

// GetLibraryItem returns a single audiobook from the user's library.
func (s *Service) GetLibraryItem(ctx context.Context, audiobookID, userID string) (*models.Audiobook, error) {
	// First check if user has this book in their library
	hasAccess, err := s.repo.UserHasAudiobookInLibrary(ctx, userID, audiobookID)
	if err != nil {
		return nil, err
	}
	if !hasAccess {
		return nil, fmt.Errorf("audiobook not found in user's library")
	}

	return s.repo.GetAudiobook(ctx, audiobookID, userID)
}

// UpdateProgress records listening progress for a user (requires book to be in their library).
func (s *Service) UpdateProgress(ctx context.Context, userID, audiobookID string, progressSec float64) (*models.UserAudiobookData, error) {
	// Check if user has this book in their library
	hasAccess, err := s.repo.UserHasAudiobookInLibrary(ctx, userID, audiobookID)
	if err != nil {
		return nil, err
	}
	if !hasAccess {
		return nil, fmt.Errorf("audiobook not found in user's library")
	}

	now := time.Now().UTC()
	return s.repo.UpdateUserProgress(ctx, userID, audiobookID, progressSec, &now)
}

// SetFavorite sets or clears the favorite flag for a user (requires book to be in their library).
func (s *Service) SetFavorite(ctx context.Context, userID, audiobookID string, isFavorite bool) (*models.UserAudiobookData, error) {
	// Check if user has this book in their library
	hasAccess, err := s.repo.UserHasAudiobookInLibrary(ctx, userID, audiobookID)
	if err != nil {
		return nil, err
	}
	if !hasAccess {
		return nil, fmt.Errorf("audiobook not found in user's library")
	}

	return s.repo.SetUserFavorite(ctx, userID, audiobookID, isFavorite)
}

func (s *Service) resolveLibraryForAsset(ctx context.Context, assetPath string) (string, string, error) {
	libraryPaths, err := s.repo.GetLibraryPaths(ctx)
	if err != nil {
		return "", "", err
	}

	normalizedAsset := filepath.ToSlash(filepath.Clean(assetPath))
	for _, lp := range libraryPaths {
		normalizedPath := filepath.ToSlash(filepath.Clean(lp.Path))
		if strings.HasPrefix(normalizedAsset, normalizedPath) {
			if len(lp.Libraries) == 0 {
				return "", "", fmt.Errorf("library path %s is not assigned to a library", lp.Name)
			}
			return lp.ID, lp.Libraries[0].ID, nil
		}
	}

	return "", "", fmt.Errorf("no library path registered for asset %s", assetPath)
}

type discoveredFile struct {
	Path     string
	MimeType string
}

func discoverMediaFiles(sourcePath string) (string, []discoveredFile, error) {
	info, err := os.Stat(sourcePath)
	if err != nil {
		return "", nil, fmt.Errorf("stat source: %w", err)
	}

	var base string
	var files []discoveredFile

	if info.IsDir() {
		base = sourcePath
		err = filepath.WalkDir(sourcePath, func(path string, d os.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if d.IsDir() {
				return nil
			}
			if !isAudioFile(path) {
				return nil
			}
			rel, err := filepath.Rel(base, path)
			if err != nil {
				return err
			}
			files = append(files, discoveredFile{
				Path:     filepath.ToSlash(rel),
				MimeType: mimeTypeFor(path),
			})
			return nil
		})
		if err != nil {
			return "", nil, err
		}
	} else {
		base = filepath.Dir(sourcePath)
		if isAudioFile(sourcePath) {
			files = append(files, discoveredFile{
				Path:     filepath.ToSlash(info.Name()),
				MimeType: mimeTypeFor(sourcePath),
			})
		}
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].Path < files[j].Path
	})

	if len(files) == 0 {
		return "", nil, fmt.Errorf("no audio files found in %s", sourcePath)
	}

	absBase, absErr := filepath.Abs(base)
	if absErr == nil {
		base = absBase
	}

	return base, files, nil
}

func isAudioFile(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".mp3", ".m4b", ".m4a", ".flac", ".ogg", ".wav", ".aac":
		return true
	default:
		return false
	}
}

func mimeTypeFor(path string) string {
	ext := filepath.Ext(path)
	if ext == "" {
		return "application/octet-stream"
	}
	t := mime.TypeByExtension(strings.ToLower(ext))
	if t == "" {
		return "application/octet-stream"
	}
	return t
}

// GetUserFavorites returns audiobooks the user has marked as favorite.
func (s *Service) GetUserFavorites(ctx context.Context, userID string, libraryID *string, offset, limit int) ([]models.Audiobook, int, error) {
	return s.repo.GetUserFavorites(ctx, userID, libraryID, offset, limit)
}

// GetContinueListening returns audiobooks the user is currently listening to.
func (s *Service) GetContinueListening(ctx context.Context, userID string, libraryID *string, limit int) ([]models.Audiobook, error) {
	return s.repo.GetContinueListening(ctx, userID, libraryID, limit)
}


// =============================================================================
// Metadata Overrides Management
// =============================================================================

// SaveMetadataOverrides saves manual metadata overrides for an audiobook
func (s *Service) SaveMetadataOverrides(ctx context.Context, overrides *models.MetadataOverrides) error {
	return s.repo.SaveMetadataOverrides(ctx, overrides)
}

// GetMetadataOverrides retrieves metadata overrides for an audiobook
func (s *Service) GetMetadataOverrides(ctx context.Context, audiobookID string) (*models.MetadataOverrides, error) {
	return s.repo.GetMetadataOverrides(ctx, audiobookID)
}

// DeleteMetadataOverrides removes all manual overrides for an audiobook
func (s *Service) DeleteMetadataOverrides(ctx context.Context, audiobookID string) error {
	return s.repo.DeleteMetadataOverrides(ctx, audiobookID)
}

// GetEmbeddedMetadata retrieves embedded metadata for an audiobook
func (s *Service) GetEmbeddedMetadata(ctx context.Context, audiobookID string) (*models.EmbeddedMetadata, error) {
	return s.repo.GetEmbeddedMetadata(ctx, audiobookID)
}
