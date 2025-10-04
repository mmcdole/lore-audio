package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
)

// GoogleBooksProvider implements metadata search via Google Books API
type GoogleBooksProvider struct {
	config *ProviderConfig
	client *http.Client
}

// NewGoogleBooksProvider creates a new Google Books provider
func NewGoogleBooksProvider(config *ProviderConfig) *GoogleBooksProvider {
	if config == nil {
		config = DefaultConfig()
	}
	return &GoogleBooksProvider{
		config: config,
		client: &http.Client{Timeout: config.Timeout},
	}
}

// Name returns the provider name
func (p *GoogleBooksProvider) Name() string {
	return "google"
}

// googleBooksResponse represents the Google Books API response
type googleBooksResponse struct {
	Items []googleBooksItem `json:"items"`
}

type googleBooksItem struct {
	ID         string             `json:"id"`
	VolumeInfo googleBooksVolume `json:"volumeInfo"`
}

type googleBooksVolume struct {
	Title               string                         `json:"title"`
	Subtitle            string                         `json:"subtitle"`
	Authors             []string                       `json:"authors"`
	Publisher           string                         `json:"publisher"`
	PublishedDate       string                         `json:"publishedDate"`
	Description         string                         `json:"description"`
	IndustryIdentifiers []googleBooksIdentifier        `json:"industryIdentifiers"`
	Categories          []string                       `json:"categories"`
	ImageLinks          map[string]string              `json:"imageLinks"`
}

type googleBooksIdentifier struct {
	Type       string `json:"type"`       // "ISBN_10" or "ISBN_13"
	Identifier string `json:"identifier"`
}

// Search searches Google Books for books by title and author
func (p *GoogleBooksProvider) Search(ctx context.Context, title, author string) ([]SearchResult, error) {
	if title == "" {
		return nil, nil
	}

	// Build query
	query := fmt.Sprintf("intitle:%s", url.QueryEscape(title))
	if author != "" {
		query += fmt.Sprintf("+inauthor:%s", url.QueryEscape(author))
	}

	searchURL := fmt.Sprintf("https://www.googleapis.com/books/v1/volumes?q=%s", query)

	req, err := http.NewRequestWithContext(ctx, "GET", searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("search request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("search failed with status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var apiResp googleBooksResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var results []SearchResult
	for _, item := range apiResp.Items {
		result := p.convertToSearchResult(&item)
		if result != nil {
			results = append(results, *result)
		}
	}

	return results, nil
}

// GetByID fetches book metadata by Google Books volume ID
func (p *GoogleBooksProvider) GetByID(ctx context.Context, id string) (*SearchResult, error) {
	if id == "" {
		return nil, fmt.Errorf("volume ID is required")
	}

	volumeURL := fmt.Sprintf("https://www.googleapis.com/books/v1/volumes/%s", url.PathEscape(id))

	req, err := http.NewRequestWithContext(ctx, "GET", volumeURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("volume lookup failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("volume lookup failed with status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var item googleBooksItem
	if err := json.Unmarshal(body, &item); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return p.convertToSearchResult(&item), nil
}

// convertToSearchResult converts Google Books API response to SearchResult
func (p *GoogleBooksProvider) convertToSearchResult(item *googleBooksItem) *SearchResult {
	vol := item.VolumeInfo

	if vol.Title == "" {
		return nil // Skip items without a title
	}

	result := &SearchResult{
		Provider:   p.Name(),
		ExternalID: item.ID,
		Title:      vol.Title,
	}

	// Subtitle
	if vol.Subtitle != "" {
		result.Subtitle = &vol.Subtitle
	}

	// Author
	if len(vol.Authors) > 0 {
		result.Author = strings.Join(vol.Authors, ", ")
	}

	// Publisher
	if vol.Publisher != "" {
		result.Publisher = &vol.Publisher
	}

	// Published year
	if vol.PublishedDate != "" {
		parts := strings.Split(vol.PublishedDate, "-")
		if len(parts) > 0 {
			result.PublishedYear = &parts[0]
		}
	}

	// Description
	if vol.Description != "" {
		cleaned := stripHTMLGoogle(vol.Description)
		result.Description = &cleaned
	}

	// Cover - use the largest available
	if len(vol.ImageLinks) > 0 {
		// Preference order: extraLarge, large, medium, small, thumbnail
		for _, key := range []string{"extraLarge", "large", "medium", "small", "thumbnail"} {
			if coverURL, ok := vol.ImageLinks[key]; ok {
				// Ensure HTTPS
				coverURL = strings.Replace(coverURL, "http:", "https:", 1)
				result.CoverURL = &coverURL
				break
			}
		}
	}

	// ISBN - prefer ISBN_13, fallback to ISBN_10
	if len(vol.IndustryIdentifiers) > 0 {
		for _, id := range vol.IndustryIdentifiers {
			if id.Type == "ISBN_13" {
				result.ISBN = &id.Identifier
				break
			}
		}
		// If no ISBN_13 found, try ISBN_10
		if result.ISBN == nil {
			for _, id := range vol.IndustryIdentifiers {
				if id.Type == "ISBN_10" {
					result.ISBN = &id.Identifier
					break
				}
			}
		}
	}

	// Genres/Categories
	if len(vol.Categories) > 0 {
		result.Genres = vol.Categories
	}

	return result
}

// stripHTMLGoogle removes HTML tags and decodes HTML entities from a string
func stripHTMLGoogle(s string) string {
	if s == "" {
		return ""
	}
	// Remove HTML tags
	re := regexp.MustCompile(`<[^>]*>`)
	s = re.ReplaceAllString(s, "")
	// Decode HTML entities
	s = html.UnescapeString(s)
	// Trim whitespace
	return strings.TrimSpace(s)
}
