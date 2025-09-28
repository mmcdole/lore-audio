package metadata

import (
	"context"
	"errors"

	"github.com/flix-audio/backend/internal/models"
)

// Provider fetches book metadata details from an external source.
type Provider interface {
	Search(ctx context.Context, query string) ([]models.BookMetadata, error)
	Fetch(ctx context.Context, id string) (*models.BookMetadata, error)
}

var ErrNotImplemented = errors.New("metadata provider not implemented")

// NoopProvider is a placeholder implementation that returns ErrNotImplemented.
type NoopProvider struct{}

// Search returns ErrNotImplemented.
func (NoopProvider) Search(ctx context.Context, query string) ([]models.BookMetadata, error) {
	return nil, ErrNotImplemented
}

// Fetch returns ErrNotImplemented.
func (NoopProvider) Fetch(ctx context.Context, id string) (*models.BookMetadata, error) {
	return nil, ErrNotImplemented
}
