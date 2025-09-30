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
