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
	"strconv"
	"strings"
)

// AudibleProvider implements metadata search via Audible APIs
type AudibleProvider struct {
	config *ProviderConfig
	client *http.Client
	region string // us, ca, uk, au, fr, de, jp, it, in, es
}

// NewAudibleProvider creates a new Audible provider
func NewAudibleProvider(region string, config *ProviderConfig) *AudibleProvider {
	if config == nil {
		config = DefaultConfig()
	}
	if region == "" {
		region = "us"
	}
	return &AudibleProvider{
		config: config,
		client: &http.Client{Timeout: config.Timeout},
		region: region,
	}
}

// Name returns the provider name
func (p *AudibleProvider) Name() string {
	if p.region == "us" {
		return "audible"
	}
	return fmt.Sprintf("audible.%s", p.region)
}

// audnexusBook represents the API response from api.audnex.us
type audnexusBook struct {
	ASIN              string                 `json:"asin"`
	Title             string                 `json:"title"`
	Subtitle          string                 `json:"subtitle"`
	Authors           []audnexusPerson       `json:"authors"`
	Narrators         []audnexusPerson       `json:"narrators"`
	PublisherName     string                 `json:"publisherName"`
	Summary           string                 `json:"summary"`
	ReleaseDate       string                 `json:"releaseDate"`
	Image             string                 `json:"image"`
	Genres            []audnexusGenre        `json:"genres"`
	SeriesPrimary     *audnexusSeries        `json:"seriesPrimary"`
	SeriesSecondary   *audnexusSeries        `json:"seriesSecondary"`
	Language          string                 `json:"language"`
	RuntimeLengthMin  float64                `json:"runtimeLengthMin"`
	FormatType        string                 `json:"formatType"`
	ISBN              string                 `json:"isbn"`
	Rating            string                 `json:"rating"` // API returns string, not float
}

type audnexusPerson struct {
	Name string `json:"name"`
}

type audnexusGenre struct {
	Name string `json:"name"`
	Type string `json:"type"` // "genre" or "tag"
}

type audnexusSeries struct {
	Name     string `json:"name"`
	Position string `json:"position"`
}

// audibleSearchResponse represents the response from api.audible.com search
type audibleSearchResponse struct {
	Products []audibleProduct `json:"products"`
}

type audibleProduct struct {
	ASIN string `json:"asin"`
}

// isValidASIN checks if a string is a valid ASIN format
func isValidASIN(s string) bool {
	match, _ := regexp.MatchString(`^[A-Z0-9]{10}$`, s)
	return match
}

// cleanSeriesSequence extracts numeric sequence from series position
func cleanSeriesSequence(sequence string) string {
	if sequence == "" {
		return ""
	}
	// Match any number with optional decimal (e.g, 1 or 1.5 or .5)
	re := regexp.MustCompile(`\.\d+|\d+(?:\.\d+)?`)
	matches := re.FindString(sequence)
	if matches != "" {
		return matches
	}
	return sequence
}

// stripHTML removes HTML tags and decodes HTML entities from a string
func stripHTML(s string) string {
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

// Search searches Audible for audiobooks by title and author
func (p *AudibleProvider) Search(ctx context.Context, title, author string) ([]SearchResult, error) {
	if title == "" {
		return nil, nil
	}

	var results []SearchResult

	// Try ASIN search if title looks like an ASIN
	if isValidASIN(strings.ToUpper(title)) {
		result, err := p.GetByID(ctx, title)
		if err == nil && result != nil {
			return []SearchResult{*result}, nil
		}
	}

	// Otherwise do text search
	tld := p.getTLD()
	query := url.Values{}
	query.Set("num_results", "10")
	query.Set("products_sort_by", "Relevance")
	query.Set("title", title)
	if author != "" {
		query.Set("author", author)
	}

	searchURL := fmt.Sprintf("https://api.audible%s/1.0/catalog/products?%s", tld, query.Encode())

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

	var searchResp audibleSearchResponse
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Fetch full details for each ASIN
	for _, product := range searchResp.Products {
		result, err := p.GetByID(ctx, product.ASIN)
		if err != nil {
			continue // Skip failed lookups
		}
		if result != nil {
			results = append(results, *result)
		}
	}

	return results, nil
}

// GetByID fetches audiobook metadata by ASIN
func (p *AudibleProvider) GetByID(ctx context.Context, asin string) (*SearchResult, error) {
	if asin == "" {
		return nil, fmt.Errorf("ASIN is required")
	}

	asin = strings.ToUpper(url.PathEscape(asin))
	regionQuery := ""
	if p.region != "us" {
		regionQuery = "?region=" + p.region
	}

	audnexusURL := fmt.Sprintf("https://api.audnex.us/books/%s%s", asin, regionQuery)

	req, err := http.NewRequestWithContext(ctx, "GET", audnexusURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ASIN lookup failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ASIN lookup failed with status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var book audnexusBook
	if err := json.Unmarshal(body, &book); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if book.ASIN == "" {
		return nil, fmt.Errorf("invalid response: missing ASIN")
	}

	return p.convertToSearchResult(&book), nil
}

// convertToSearchResult converts audnexus API response to SearchResult
func (p *AudibleProvider) convertToSearchResult(book *audnexusBook) *SearchResult {
	result := &SearchResult{
		Provider:   p.Name(),
		ExternalID: book.ASIN,
		Title:      book.Title,
	}

	// Subtitle
	if book.Subtitle != "" {
		result.Subtitle = &book.Subtitle
	}

	// Authors
	if len(book.Authors) > 0 {
		authors := make([]string, len(book.Authors))
		for i, a := range book.Authors {
			authors[i] = a.Name
		}
		result.Author = strings.Join(authors, ", ")
	}

	// Narrators
	if len(book.Narrators) > 0 {
		narrators := make([]string, len(book.Narrators))
		for i, n := range book.Narrators {
			narrators[i] = n.Name
		}
		narrator := strings.Join(narrators, ", ")
		result.Narrator = &narrator
	}

	// Publisher
	if book.PublisherName != "" {
		result.Publisher = &book.PublisherName
	}

	// Published year
	if book.ReleaseDate != "" {
		parts := strings.Split(book.ReleaseDate, "-")
		if len(parts) > 0 {
			result.PublishedYear = &parts[0]
		}
	}

	// Description
	if book.Summary != "" {
		cleaned := stripHTML(book.Summary)
		result.Description = &cleaned
	}

	// Cover
	if book.Image != "" {
		result.CoverURL = &book.Image
	}

	// ISBN and ASIN
	if book.ISBN != "" {
		result.ISBN = &book.ISBN
	}
	if book.ASIN != "" {
		result.ASIN = &book.ASIN
	}

	// Genres and tags
	var genres []string
	var tags []string
	for _, g := range book.Genres {
		if g.Type == "genre" {
			genres = append(genres, g.Name)
		} else if g.Type == "tag" {
			tags = append(tags, g.Name)
		}
	}
	if len(genres) > 0 {
		result.Genres = genres
	}
	if len(tags) > 0 {
		result.Tags = tags
	}

	// Series
	if book.SeriesPrimary != nil && book.SeriesPrimary.Name != "" {
		result.SeriesName = &book.SeriesPrimary.Name
		sequence := cleanSeriesSequence(book.SeriesPrimary.Position)
		if sequence != "" {
			result.SeriesSequence = &sequence
		}
	}

	// Language
	if book.Language != "" {
		// Capitalize first letter
		lang := strings.Title(strings.ToLower(book.Language))
		result.Language = &lang
	}

	// Duration
	if book.RuntimeLengthMin > 0 {
		result.DurationMin = &book.RuntimeLengthMin
	}

	// Rating - parse from string
	if book.Rating != "" {
		if rating, err := strconv.ParseFloat(book.Rating, 64); err == nil && rating > 0 {
			result.Rating = &rating
		}
	}

	return result
}

// getTLD returns the top-level domain for the region
func (p *AudibleProvider) getTLD() string {
	switch p.region {
	case "ca":
		return ".ca"
	case "uk":
		return ".co.uk"
	case "au":
		return ".com.au"
	case "fr":
		return ".fr"
	case "de":
		return ".de"
	case "jp":
		return ".co.jp"
	case "it":
		return ".it"
	case "in":
		return ".in"
	case "es":
		return ".es"
	default:
		return ".com"
	}
}
