package validation

import (
	"context"
	"path/filepath"
	"regexp"
	"strings"
	"unicode/utf8"

	apperrors "github.com/flix-audio/backend/internal/errors"
)

// Validator provides input validation utilities
type Validator struct{}

// NewValidator creates a new validator instance
func NewValidator() *Validator {
	return &Validator{}
}

// Username validation
func (v *Validator) ValidateUsername(username string) error {
	if username == "" {
		return apperrors.NewValidationError("username", "username is required", username)
	}

	if len(username) < 3 {
		return apperrors.NewValidationError("username", "username must be at least 3 characters", username)
	}

	if len(username) > 50 {
		return apperrors.NewValidationError("username", "username must be less than 50 characters", username)
	}

	// Only allow alphanumeric characters, underscores, and hyphens
	if matched, _ := regexp.MatchString(`^[a-zA-Z0-9_-]+$`, username); !matched {
		return apperrors.NewValidationError("username", "username can only contain letters, numbers, underscores, and hyphens", username)
	}

	return nil
}

// Password validation
func (v *Validator) ValidatePassword(password string) error {
	if password == "" {
		return apperrors.NewValidationError("password", "password is required", nil)
	}

	if len(password) < 8 {
		return apperrors.NewValidationError("password", "password must be at least 8 characters", nil)
	}

	if len(password) > 128 {
		return apperrors.NewValidationError("password", "password must be less than 128 characters", nil)
	}

	// Ensure password is valid UTF-8
	if !utf8.ValidString(password) {
		return apperrors.NewValidationError("password", "password must be valid UTF-8", nil)
	}

	return nil
}

// Progress validation
func (v *Validator) ValidateProgress(progressSec float64) error {
	if progressSec < 0 {
		return apperrors.NewValidationError("progress_sec", "progress cannot be negative", progressSec)
	}

	// Allow very large values but set a reasonable upper bound (1000 hours)
	if progressSec > 3600000 {
		return apperrors.NewValidationError("progress_sec", "progress value too large", progressSec)
	}

	return nil
}

// AudiobookID validation
func (v *Validator) ValidateAudiobookID(audiobookID string) error {
	if audiobookID == "" {
		return apperrors.NewValidationError("audiobook_id", "audiobook ID is required", audiobookID)
	}

	// UUIDs should be 36 characters (including hyphens)
	if len(audiobookID) != 36 {
		return apperrors.NewValidationError("audiobook_id", "invalid audiobook ID format", audiobookID)
	}

	// Basic UUID format validation
	if matched, _ := regexp.MatchString(`^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`, audiobookID); !matched {
		return apperrors.NewValidationError("audiobook_id", "invalid audiobook ID format", audiobookID)
	}

	return nil
}

// UserID validation (same as audiobook ID)
func (v *Validator) ValidateUserID(userID string) error {
	if userID == "" {
		return apperrors.NewValidationError("user_id", "user ID is required", userID)
	}

	// UUIDs should be 36 characters (including hyphens)
	if len(userID) != 36 {
		return apperrors.NewValidationError("user_id", "invalid user ID format", userID)
	}

	// Basic UUID format validation
	if matched, _ := regexp.MatchString(`^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`, userID); !matched {
		return apperrors.NewValidationError("user_id", "invalid user ID format", userID)
	}

	return nil
}

// File path validation
func (v *Validator) ValidateFilePath(path string) error {
	if path == "" {
		return apperrors.NewValidationError("path", "file path is required", path)
	}

	// Clean the path to prevent path traversal
	cleanPath := filepath.Clean(path)

	// Check for path traversal attempts
	if strings.Contains(cleanPath, "..") {
		return apperrors.NewValidationError("path", "path traversal not allowed", path)
	}

	// Ensure it's an absolute path
	if !filepath.IsAbs(cleanPath) {
		return apperrors.NewValidationError("path", "path must be absolute", path)
	}

	return nil
}

// Pagination validation
func (v *Validator) ValidatePagination(offset, limit int) (int, int, error) {
	if offset < 0 {
		return 0, 0, apperrors.NewValidationError("offset", "offset cannot be negative", offset)
	}

	if limit <= 0 {
		limit = 50 // Default limit
	}

	if limit > 100 {
		return 0, 0, apperrors.NewValidationError("limit", "limit cannot exceed 100", limit)
	}

	return offset, limit, nil
}

// Search query validation
func (v *Validator) ValidateSearchQuery(query string) error {
	if query == "" {
		return apperrors.NewValidationError("q", "search query is required", query)
	}

	if len(query) < 2 {
		return apperrors.NewValidationError("q", "search query must be at least 2 characters", query)
	}

	if len(query) > 200 {
		return apperrors.NewValidationError("q", "search query must be less than 200 characters", query)
	}

	// Ensure query is valid UTF-8
	if !utf8.ValidString(query) {
		return apperrors.NewValidationError("q", "search query must be valid UTF-8", query)
	}

	return nil
}

// Metadata ID validation
func (v *Validator) ValidateMetadataID(metadataID string) error {
	if metadataID == "" {
		return apperrors.NewValidationError("metadata_id", "metadata ID is required", metadataID)
	}

	if len(metadataID) > 100 {
		return apperrors.NewValidationError("metadata_id", "metadata ID too long", metadataID)
	}

	// Ensure it's valid UTF-8
	if !utf8.ValidString(metadataID) {
		return apperrors.NewValidationError("metadata_id", "metadata ID must be valid UTF-8", metadataID)
	}

	return nil
}

// Context validation helper
func (v *Validator) ValidateContext(ctx context.Context) error {
	if ctx == nil {
		return apperrors.NewValidationError("context", "context cannot be nil", nil)
	}

	return nil
}

// Validate multiple fields and return the first error
func (v *Validator) ValidateAll(validators ...func() error) error {
	for _, validate := range validators {
		if err := validate(); err != nil {
			return err
		}
	}
	return nil
}