package models

import "time"

// Audiobook represents a managed audiobook in the library.
type Audiobook struct {
	ID               string             `json:"id"`
	LibraryID        *string            `json:"library_id,omitempty"`
	LibraryPathID    string             `json:"library_path_id"`
	MetadataID       *string            `json:"metadata_id,omitempty"`
	AssetPath        string             `json:"asset_path"`
	CreatedAt        time.Time          `json:"created_at"`
	UpdatedAt        time.Time          `json:"updated_at"`
	MediaFiles       []MediaFile        `json:"media_files,omitempty"`
	Metadata         *BookMetadata      `json:"metadata,omitempty"`
	UserData         *UserAudiobookData `json:"user_data,omitempty"`
	InLibrary        bool               `json:"in_library"`
	FileCount        int                `json:"file_count,omitempty"`
	TotalDurationSec float64            `json:"total_duration_sec,omitempty"`
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

// BookMetadata contains the descriptive metadata for an audiobook.
type BookMetadata struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Subtitle    *string `json:"subtitle,omitempty"`
	Author      string  `json:"author"`
	Narrator    *string `json:"narrator,omitempty"`
	Description *string `json:"description,omitempty"`
	CoverURL    *string `json:"cover_url,omitempty"`
	SeriesInfo  *string `json:"series_info,omitempty"`
	ReleaseDate *string `json:"release_date,omitempty"`
}

// User represents a user account in the system.
type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"` // Never expose password hash in JSON
	IsAdmin      bool      `json:"is_admin"`
	APIKey       *string   `json:"api_key,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// UserLibrary represents the many-to-many relationship between users and audiobooks.
type UserLibrary struct {
	UserID      string    `json:"user_id"`
	AudiobookID string    `json:"audiobook_id"`
	AddedAt     time.Time `json:"added_at"`
}

// UserAudiobookData stores per-user listening information for books in their library.
type UserAudiobookData struct {
	UserID       string     `json:"user_id"`
	AudiobookID  string     `json:"audiobook_id"`
	ProgressSec  float64    `json:"progress_sec"`
	IsFavorite   bool       `json:"is_favorite"`
	LastPlayedAt *time.Time `json:"last_played_at,omitempty"`
	AddedAt      *time.Time `json:"added_at,omitempty"` // From user_library join
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
