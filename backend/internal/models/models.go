package models

import "time"

// Audiobook represents a managed audiobook in the library.
type Audiobook struct {
	ID                  string              `json:"id"`
	LibraryID           *string             `json:"library_id,omitempty"`
	LibraryPathID       string              `json:"library_path_id"`
	AgentMetadataID     *string             `json:"agent_metadata_id,omitempty"`
	AssetPath           string              `json:"asset_path"`
	CreatedAt           time.Time           `json:"created_at"`
	UpdatedAt           time.Time           `json:"updated_at"`
	MediaFiles          []MediaFile         `json:"media_files,omitempty"`
	AgentMetadata       *AgentMetadata      `json:"agent_metadata,omitempty"`
	EmbeddedMetadata    *EmbeddedMetadata   `json:"embedded_metadata,omitempty"`
	MetadataOverrides   *MetadataOverrides  `json:"metadata_overrides,omitempty"`
	UserData            *UserAudiobookData  `json:"user_data,omitempty"`
	FileCount           int                 `json:"file_count,omitempty"`
	TotalDurationSec    float64             `json:"total_duration_sec,omitempty"`

	// Backward compatibility - populated from AgentMetadata
	Metadata            *BookMetadata       `json:"metadata,omitempty"`
	MetadataID          *string             `json:"metadata_id,omitempty"`
}

// Library represents a named collection of audiobooks.
type Library struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	DisplayName string                 `json:"display_name"`
	Type        string                 `json:"type"`
	Description *string                `json:"description,omitempty"`
	Settings    map[string]interface{} `json:"settings,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`

	BookCount   int           `json:"book_count,omitempty"`
	Directories []LibraryPath `json:"directories,omitempty"`
}

// LibrarySummary describes minimal library information used for computed relationships.
type LibrarySummary struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Type        string `json:"type"`
}

// LibraryDirectory represents the many-to-many relationship between libraries and directories.
type LibraryDirectory struct {
	LibraryID   string    `json:"library_id"`
	DirectoryID string    `json:"directory_id"`
	CreatedAt   time.Time `json:"created_at"`
}

// UserLibraryAccess controls per-user access to a library.
type UserLibraryAccess struct {
	UserID    string    `json:"user_id"`
	LibraryID string    `json:"library_id"`
	CanRead   bool      `json:"can_read"`
	CanWrite  bool      `json:"can_write"`
	CreatedAt time.Time `json:"created_at"`
}

// MediaFile represents a single audio track that belongs to an audiobook.
type MediaFile struct {
	ID          string  `json:"id"`
	AudiobookID string  `json:"audiobook_id"`
	Filename    string  `json:"filename"`
	DurationSec float64 `json:"duration_sec"`
	MimeType    string  `json:"mime_type"`
}

// FieldOverride represents a single field override with lock status
type FieldOverride struct {
	Value  *string `json:"value,omitempty"` // nil = no override, just locked
	Locked bool    `json:"locked"`          // true = prevent agent updates
}

// AgentMetadata represents metadata from external providers (can be shared across audiobooks)
type AgentMetadata struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	Subtitle     *string   `json:"subtitle,omitempty"`
	Author       string    `json:"author"`
	Narrator     *string   `json:"narrator,omitempty"`
	Description  *string   `json:"description,omitempty"`
	CoverURL     *string   `json:"cover_url,omitempty"`
	SeriesInfo   *string   `json:"series_info,omitempty"`
	ReleaseDate  *string   `json:"release_date,omitempty"`
	ISBN         *string   `json:"isbn,omitempty"`
	ASIN         *string   `json:"asin,omitempty"`
	Language     *string   `json:"language,omitempty"`
	Publisher    *string   `json:"publisher,omitempty"`
	DurationSec  *float64  `json:"duration_sec,omitempty"`
	Rating       *float64  `json:"rating,omitempty"`
	RatingCount  *int      `json:"rating_count,omitempty"`
	Genres       *string   `json:"genres,omitempty"` // JSON array
	Source       string    `json:"source"`
	ExternalID   *string   `json:"external_id,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// EmbeddedMetadata represents metadata extracted from file tags (1:1 with audiobook)
type EmbeddedMetadata struct {
	AudiobookID   string    `json:"audiobook_id"`
	Title         *string   `json:"title,omitempty"`
	Subtitle      *string   `json:"subtitle,omitempty"`
	Author        *string   `json:"author,omitempty"`
	Narrator      *string   `json:"narrator,omitempty"`
	Album         *string   `json:"album,omitempty"`
	Genre         *string   `json:"genre,omitempty"`
	Year          *string   `json:"year,omitempty"`
	TrackNumber   *string   `json:"track_number,omitempty"`
	Comment       *string   `json:"comment,omitempty"`
	EmbeddedCover []byte    `json:"-"` // Not serialized in JSON
	CoverMimeType *string   `json:"cover_mime_type,omitempty"`
	ExtractedAt   time.Time `json:"extracted_at"`
}

// MetadataOverrides represents user manual edits (1:1 with audiobook)
type MetadataOverrides struct {
	AudiobookID string                   `json:"audiobook_id"`
	Overrides   map[string]FieldOverride `json:"overrides"` // Field name -> override + lock
	UpdatedAt   time.Time                `json:"updated_at"`
	UpdatedBy   *string                  `json:"updated_by,omitempty"`
}

// BookMetadata is an alias for AgentMetadata for backward compatibility
type BookMetadata = AgentMetadata

// User represents a user account in the system.
type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"` // Never expose password hash in JSON
	IsAdmin      bool      `json:"is_admin"`
	APIKey       *string   `json:"api_key,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// UserAudiobookData stores per-user listening information for books in their library.
type UserAudiobookData struct {
	UserID       string     `json:"user_id"`
	AudiobookID  string     `json:"audiobook_id"`
	ProgressSec  float64    `json:"progress_sec"`
	IsFavorite   bool       `json:"is_favorite"`
	LastPlayedAt *time.Time `json:"last_played_at,omitempty"`
}

// LibraryPath represents a configured library directory.
type LibraryPath struct {
	ID            string           `json:"id"`
	Path          string           `json:"path"`
	Name          string           `json:"name"`
	Enabled       bool             `json:"enabled"`
	CreatedAt     time.Time        `json:"created_at"`
	LastScannedAt *time.Time       `json:"last_scanned_at,omitempty"`
	BookCount     int              `json:"book_count,omitempty"` // Computed field
	Libraries     []LibrarySummary `json:"libraries,omitempty"`
}

// ImportFolder represents a configured import staging directory.
type ImportFolder struct {
	ID        string    `json:"id"`
	Path      string    `json:"path"`
	Name      string    `json:"name"`
	Enabled   bool      `json:"enabled"`
	CreatedAt time.Time `json:"created_at"`
}

// ImportSettings represents global import configuration.
type ImportSettings struct {
	ID              string    `json:"id"`
	DestinationPath string    `json:"destination_path"`
	Template        string    `json:"template"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// SeriesInfo represents aggregated information about a book series.
type SeriesInfo struct {
	Name             string          `json:"name"`
	BookCount        int             `json:"book_count"`
	TotalDurationSec float64         `json:"total_duration_sec"`
	UserProgress     *SeriesProgress `json:"user_progress,omitempty"`
}

// SeriesProgress tracks user progress within a series.
type SeriesProgress struct {
	BooksStarted   int `json:"books_started"`
	BooksCompleted int `json:"books_completed"`
}

// AuthorInfo represents aggregated information about an author.
type AuthorInfo struct {
	Name      string           `json:"name"`
	BookCount int              `json:"book_count"`
	UserStats *AuthorUserStats `json:"user_stats,omitempty"`
}

// AuthorUserStats tracks user statistics for an author's books.
type AuthorUserStats struct {
	BooksStarted   int `json:"books_started"`
	BooksCompleted int `json:"books_completed"`
}

// UserStats represents aggregated statistics for a user's listening activity.
type UserStats struct {
	StreakDays             int     `json:"streak_days"`
	TotalHours             float64 `json:"total_hours"`
	BooksCompleted         int     `json:"books_completed"`
	BooksInProgress        int     `json:"books_in_progress"`
	FavoriteCount          int     `json:"favorite_count"`
	ListeningTimeThisWeek  float64 `json:"listening_time_this_week"`
	ListeningTimeThisMonth float64 `json:"listening_time_this_month"`
}

// FilterCounts represents counts for different audiobook filters.
type FilterCounts struct {
	All        int `json:"all"`
	NotStarted int `json:"not_started"`
	Listening  int `json:"listening"`
	Completed  int `json:"completed"`
	Favorites  int `json:"favorites"`
}

// ResolveMetadata computes the final display metadata by merging all layers.
// Priority: Manual Overrides (tier 1) > Agent Metadata (tier 2) > Embedded Metadata (tier 3)
// Locked fields prevent agent/embedded metadata from being applied.
func (a *Audiobook) ResolveMetadata() *AgentMetadata {
	if a == nil {
		return nil
	}

	resolved := &AgentMetadata{}

	// Tier 3: Embedded metadata (lowest priority, currently stubbed)
	// Future: Apply embedded metadata here when extraction is implemented
	// if a.EmbeddedMetadata != nil {
	//     if !a.isFieldLocked("title") && a.EmbeddedMetadata.Title != nil {
	//         resolved.Title = *a.EmbeddedMetadata.Title
	//     }
	//     // ... etc for other fields
	// }

	// Tier 2: Agent metadata (middle priority, only if field not locked)
	if a.Metadata != nil {
		if !a.isFieldLocked("title") {
			resolved.Title = a.Metadata.Title
		}
		if !a.isFieldLocked("subtitle") {
			resolved.Subtitle = a.Metadata.Subtitle
		}
		if !a.isFieldLocked("author") {
			resolved.Author = a.Metadata.Author
		}
		if !a.isFieldLocked("narrator") {
			resolved.Narrator = a.Metadata.Narrator
		}
		if !a.isFieldLocked("description") {
			resolved.Description = a.Metadata.Description
		}
		if !a.isFieldLocked("cover_url") {
			resolved.CoverURL = a.Metadata.CoverURL
		}
		if !a.isFieldLocked("series_info") {
			resolved.SeriesInfo = a.Metadata.SeriesInfo
		}
		if !a.isFieldLocked("release_date") {
			resolved.ReleaseDate = a.Metadata.ReleaseDate
		}
		if !a.isFieldLocked("isbn") {
			resolved.ISBN = a.Metadata.ISBN
		}
		if !a.isFieldLocked("asin") {
			resolved.ASIN = a.Metadata.ASIN
		}
		if !a.isFieldLocked("language") {
			resolved.Language = a.Metadata.Language
		}
		if !a.isFieldLocked("publisher") {
			resolved.Publisher = a.Metadata.Publisher
		}
		if !a.isFieldLocked("duration_sec") {
			resolved.DurationSec = a.Metadata.DurationSec
		}
		if !a.isFieldLocked("rating") {
			resolved.Rating = a.Metadata.Rating
		}
		if !a.isFieldLocked("rating_count") {
			resolved.RatingCount = a.Metadata.RatingCount
		}
		if !a.isFieldLocked("genres") {
			resolved.Genres = a.Metadata.Genres
		}
		// Copy metadata fields that don't get overridden
		resolved.ID = a.Metadata.ID
		resolved.Source = a.Metadata.Source
		resolved.ExternalID = a.Metadata.ExternalID
		resolved.CreatedAt = a.Metadata.CreatedAt
		resolved.UpdatedAt = a.Metadata.UpdatedAt
	}

	// Tier 1: Manual overrides (highest priority, always wins)
	if a.MetadataOverrides != nil {
		if override, ok := a.MetadataOverrides.Overrides["title"]; ok && override.Value != nil {
			resolved.Title = *override.Value
		}
		if override, ok := a.MetadataOverrides.Overrides["subtitle"]; ok && override.Value != nil {
			resolved.Subtitle = override.Value
		}
		if override, ok := a.MetadataOverrides.Overrides["author"]; ok && override.Value != nil {
			resolved.Author = *override.Value
		}
		if override, ok := a.MetadataOverrides.Overrides["narrator"]; ok && override.Value != nil {
			resolved.Narrator = override.Value
		}
		if override, ok := a.MetadataOverrides.Overrides["description"]; ok && override.Value != nil {
			resolved.Description = override.Value
		}
		if override, ok := a.MetadataOverrides.Overrides["cover_url"]; ok && override.Value != nil {
			resolved.CoverURL = override.Value
		}
		if override, ok := a.MetadataOverrides.Overrides["series_info"]; ok && override.Value != nil {
			resolved.SeriesInfo = override.Value
		}
		if override, ok := a.MetadataOverrides.Overrides["release_date"]; ok && override.Value != nil {
			resolved.ReleaseDate = override.Value
		}
		if override, ok := a.MetadataOverrides.Overrides["isbn"]; ok && override.Value != nil {
			resolved.ISBN = override.Value
		}
		if override, ok := a.MetadataOverrides.Overrides["asin"]; ok && override.Value != nil {
			resolved.ASIN = override.Value
		}
		if override, ok := a.MetadataOverrides.Overrides["language"]; ok && override.Value != nil {
			resolved.Language = override.Value
		}
		if override, ok := a.MetadataOverrides.Overrides["publisher"]; ok && override.Value != nil {
			resolved.Publisher = override.Value
		}
		if override, ok := a.MetadataOverrides.Overrides["duration_sec"]; ok && override.Value != nil {
			// Parse string to float64 for duration_sec
			// Note: Value is *string, so we'd need conversion logic here
			// For now, skip complex type conversions
		}
		if override, ok := a.MetadataOverrides.Overrides["genres"]; ok && override.Value != nil {
			resolved.Genres = override.Value
		}
	}

	return resolved
}

// isFieldLocked checks if a specific metadata field is locked.
// A field is locked if it exists in MetadataOverrides with locked=true.
// Locked fields prevent agent/embedded metadata from overwriting the current value.
func (a *Audiobook) isFieldLocked(fieldName string) bool {
	if a.MetadataOverrides == nil {
		return false
	}
	override, ok := a.MetadataOverrides.Overrides[fieldName]
	return ok && override.Locked
}
