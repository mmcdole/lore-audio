package providers

import (
	"context"
	"time"
)

// Provider defines the interface for metadata providers
type Provider interface {
	// Search searches for audiobook metadata by title and author
	Search(ctx context.Context, title, author string) ([]SearchResult, error)

	// GetByID fetches metadata by provider-specific ID (e.g., ASIN, ISBN)
	GetByID(ctx context.Context, id string) (*SearchResult, error)

	// Name returns the provider name
	Name() string
}

// SearchResult represents a metadata search result from any provider
type SearchResult struct {
	// Provider info
	Provider   string `json:"provider"`    // "audible", "google", etc.
	ExternalID string `json:"external_id"` // ASIN, ISBN, etc.

	// Core metadata
	Title       string  `json:"title"`
	Subtitle    *string `json:"subtitle,omitempty"`
	Author      string  `json:"author"`
	Narrator    *string `json:"narrator,omitempty"`
	Description *string `json:"description,omitempty"`
	CoverURL    *string `json:"cover_url,omitempty"`

	// Additional metadata
	Publisher     *string  `json:"publisher,omitempty"`
	PublishedYear *string  `json:"published_year,omitempty"`
	Language      *string  `json:"language,omitempty"`
	ISBN          *string  `json:"isbn,omitempty"`
	ASIN          *string  `json:"asin,omitempty"`
	DurationMin   *float64 `json:"duration_min,omitempty"` // Duration in minutes
	Rating        *float64 `json:"rating,omitempty"`
	RatingCount   *int     `json:"rating_count,omitempty"`

	// Series info
	SeriesName     *string `json:"series_name,omitempty"`
	SeriesSequence *string `json:"series_sequence,omitempty"`

	// Genres/tags
	Genres []string `json:"genres,omitempty"`
	Tags   []string `json:"tags,omitempty"`

	// Match confidence (0.0 - 1.0)
	Confidence *float64 `json:"confidence,omitempty"`
}

// ProviderConfig holds configuration for providers
type ProviderConfig struct {
	Timeout time.Duration
}

// DefaultConfig returns default provider configuration
func DefaultConfig() *ProviderConfig {
	return &ProviderConfig{
		Timeout: 30 * time.Second,
	}
}
