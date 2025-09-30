package testdata

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type TestBook struct {
	Title        string
	Subtitle     string
	Author       string
	Narrator     string
	Description  string
	SeriesInfo   string // JSON string or empty
	DurationSec  float64
	CoverURL     string
	// User state
	ProgressSec  float64
	IsFavorite   bool
	LastPlayedAt *time.Time
}

// SeedTestBooks populates the database with test audiobooks for development/testing.
// It creates a test library, test user, and audiobooks with various states.
func SeedTestBooks(ctx context.Context, db *sql.DB) error {
	fmt.Println("🌱 Starting test data seeding...")

	// Clear existing test data
	if err := clearTestData(ctx, db); err != nil {
		return fmt.Errorf("failed to clear test data: %w", err)
	}

	// Create test user (or get existing admin)
	userID, err := getOrCreateTestUser(ctx, db)
	if err != nil {
		return fmt.Errorf("failed to get/create test user: %w", err)
	}

	// Create Fiction library
	fictionLibraryID := uuid.NewString()
	fictionPathID := uuid.NewString()
	if err := createTestLibrary(ctx, db, fictionLibraryID, fictionPathID, "fiction-library", "Fiction", "/tmp/test-audiobooks/fiction"); err != nil {
		return fmt.Errorf("failed to create fiction library: %w", err)
	}

	// Create Non-Fiction library
	nonfictionLibraryID := uuid.NewString()
	nonfictionPathID := uuid.NewString()
	if err := createTestLibrary(ctx, db, nonfictionLibraryID, nonfictionPathID, "nonfiction-library", "Non-Fiction", "/tmp/test-audiobooks/nonfiction"); err != nil {
		return fmt.Errorf("failed to create non-fiction library: %w", err)
	}

	// Create fiction books
	fictionBooks := getFictionBooks()
	for i, book := range fictionBooks {
		if err := createTestBook(ctx, db, fictionLibraryID, fictionPathID, userID, book); err != nil {
			return fmt.Errorf("failed to create fiction book %d: %w", i, err)
		}
	}

	// Create non-fiction books
	nonfictionBooks := getNonfictionBooks()
	for i, book := range nonfictionBooks {
		if err := createTestBook(ctx, db, nonfictionLibraryID, nonfictionPathID, userID, book); err != nil {
			return fmt.Errorf("failed to create non-fiction book %d: %w", i, err)
		}
	}

	fmt.Printf("✅ Seeded %d fiction and %d non-fiction books successfully!\n", len(fictionBooks), len(nonfictionBooks))
	return nil
}

func clearTestData(ctx context.Context, db *sql.DB) error {
	fmt.Println("🧹 Clearing existing test data...")

	// Delete test audiobooks and their related data (cascades handle most cleanup)
	_, err := db.ExecContext(ctx, `
		DELETE FROM audiobooks
		WHERE library_id IN (
			SELECT id FROM libraries WHERE name IN ('fiction-library', 'nonfiction-library', 'test-library')
		)
	`)
	if err != nil {
		return err
	}

	// Delete test libraries and library paths
	_, err = db.ExecContext(ctx, `DELETE FROM libraries WHERE name IN ('fiction-library', 'nonfiction-library', 'test-library')`)
	if err != nil {
		return err
	}

	_, err = db.ExecContext(ctx, `DELETE FROM library_paths WHERE path LIKE '/tmp/test-audiobooks%'`)
	return err
}

func createTestLibrary(ctx context.Context, db *sql.DB, libraryID, libraryPathID, name, displayName, path string) error {
	now := time.Now().UTC().Format(time.RFC3339)

	// Create library path
	_, err := db.ExecContext(ctx, `
		INSERT INTO library_paths (id, path, name, enabled, created_at)
		VALUES (?, ?, ?, 1, ?)
	`, libraryPathID, path, displayName+" Path", now)
	if err != nil {
		return err
	}

	// Create library
	_, err = db.ExecContext(ctx, `
		INSERT INTO libraries (id, name, display_name, type, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, libraryID, name, displayName, "audiobook", now, now)
	if err != nil {
		return err
	}

	// Link library to directory
	_, err = db.ExecContext(ctx, `
		INSERT INTO library_directories (library_id, directory_id, created_at)
		VALUES (?, ?, ?)
	`, libraryID, libraryPathID, now)
	return err
}

func getOrCreateTestUser(ctx context.Context, db *sql.DB) (string, error) {
	// Try to get existing admin user
	var userID string
	err := db.QueryRowContext(ctx, `SELECT id FROM users WHERE username = 'admin' LIMIT 1`).Scan(&userID)
	if err == nil {
		fmt.Printf("📝 Using existing admin user: %s\n", userID)
		return userID, nil
	}

	// If no admin exists, create test user
	userID = uuid.NewString()
	now := time.Now().UTC().Format(time.RFC3339)
	_, err = db.ExecContext(ctx, `
		INSERT INTO users (id, username, password_hash, is_admin, created_at)
		VALUES (?, ?, ?, 1, ?)
	`, userID, "testuser", "$2a$10$dummy_hash_for_testing", now)
	if err != nil {
		return "", err
	}

	fmt.Printf("📝 Created test user: %s\n", userID)
	return userID, nil
}

func createTestBook(ctx context.Context, db *sql.DB, libraryID, libraryPathID, userID string, book TestBook) error {
	now := time.Now().UTC().Format(time.RFC3339)

	// Create metadata
	metadataID := uuid.NewString()
	var subtitle, narrator, description, coverURL, seriesInfo *string
	if book.Subtitle != "" {
		subtitle = &book.Subtitle
	}
	if book.Narrator != "" {
		narrator = &book.Narrator
	}
	if book.Description != "" {
		description = &book.Description
	}
	if book.CoverURL != "" {
		coverURL = &book.CoverURL
	}
	if book.SeriesInfo != "" {
		seriesInfo = &book.SeriesInfo
	}

	_, err := db.ExecContext(ctx, `
		INSERT INTO book_metadata (id, title, subtitle, author, narrator, description, cover_url, series_info)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, metadataID, book.Title, subtitle, book.Author, narrator, description, coverURL, seriesInfo)
	if err != nil {
		return err
	}

	// Create audiobook
	audiobookID := uuid.NewString()
	assetPath := fmt.Sprintf("/tmp/test-audiobooks/%s", audiobookID)
	_, err = db.ExecContext(ctx, `
		INSERT INTO audiobooks (id, library_id, library_path_id, metadata_id, asset_path, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, audiobookID, libraryID, libraryPathID, metadataID, assetPath, now, now)
	if err != nil {
		return err
	}

	// Create media file (single file per book for simplicity)
	mediaFileID := uuid.NewString()
	_, err = db.ExecContext(ctx, `
		INSERT INTO media_files (id, audiobook_id, filename, duration_sec, mime_type)
		VALUES (?, ?, ?, ?, ?)
	`, mediaFileID, audiobookID, "audiobook.m4b", book.DurationSec, "audio/x-m4b")
	if err != nil {
		return err
	}

	// Create user data if book has progress, is favorite, or has been played
	if book.ProgressSec > 0 || book.IsFavorite || book.LastPlayedAt != nil {
		var lastPlayedAt *string
		if book.LastPlayedAt != nil {
			lpa := book.LastPlayedAt.UTC().Format(time.RFC3339)
			lastPlayedAt = &lpa
		}

		isFavInt := 0
		if book.IsFavorite {
			isFavInt = 1
		}

		_, err = db.ExecContext(ctx, `
			INSERT INTO user_audiobook_data (user_id, audiobook_id, progress_sec, is_favorite, last_played_at)
			VALUES (?, ?, ?, ?, ?)
		`, userID, audiobookID, book.ProgressSec, isFavInt, lastPlayedAt)
		if err != nil {
			return err
		}
	}

	fmt.Printf("  ✓ Created: %s by %s\n", book.Title, book.Author)
	return nil
}

func getFictionBooks() []TestBook {
	now := time.Now()
	yesterday := now.Add(-24 * time.Hour)
	twoDaysAgo := now.Add(-48 * time.Hour)
	lastWeek := now.Add(-7 * 24 * time.Hour)
	lastMonth := now.Add(-30 * 24 * time.Hour)

	return []TestBook{
		// Not Started (no user_data) - 5 books
		{
			Title:       "The Midnight Library",
			Author:      "Matt Haig",
			Narrator:    "Carey Mulligan",
			Description: "Between life and death there is a library...",
			DurationSec: 10800, // 3 hours
		},
		{
			Title:       "Project Hail Mary",
			Author:      "Andy Weir",
			Narrator:    "Ray Porter",
			Description: "A lone astronaut must save the earth from disaster...",
			DurationSec: 57600, // 16 hours
		},
		{
			Title:       "The Silent Patient",
			Author:      "Alex Michaelides",
			Narrator:    "Louise Brealey, Jack Hawkins",
			Description: "A woman shoots her husband and then never speaks again...",
			DurationSec: 30600, // 8.5 hours
		},
		{
			Title:       "The Alchemist",
			Author:      "Paulo Coelho",
			Narrator:    "Jeremy Irons",
			Description: "A mystical story about a young Spanish shepherd and his journey to find treasure.",
			DurationSec: 14400, // 4 hours
		},

		// In Progress - 4 books
		{
			Title:        "The Name of the Wind",
			Author:       "Patrick Rothfuss",
			Narrator:     "Nick Podehl",
			Description:  "The tale of Kvothe, from his childhood in a troupe of traveling players...",
			SeriesInfo:   `{"name":"The Kingkiller Chronicle","sequence":1}`,
			DurationSec:  97200,  // 27 hours
			ProgressSec:  24300,  // 25% complete
			IsFavorite:   true,
			LastPlayedAt: &yesterday,
		},
		{
			Title:        "Dune",
			Author:       "Frank Herbert",
			Narrator:     "Scott Brick",
			Description:  "Set on the desert planet Arrakis, Dune is the story of Paul Atreides...",
			DurationSec:  75600,  // 21 hours
			ProgressSec:  37800,  // 50% complete
			LastPlayedAt: &twoDaysAgo,
		},
		{
			Title:        "The Way of Kings",
			Author:       "Brandon Sanderson",
			Narrator:     "Michael Kramer, Kate Reading",
			Description:  "The first book in the epic Stormlight Archive series...",
			SeriesInfo:   `{"name":"The Stormlight Archive","sequence":1}`,
			DurationSec:  165600, // 46 hours
			ProgressSec:  124200, // 75% complete
			IsFavorite:   true,
			LastPlayedAt: &yesterday,
		},
		{
			Title:        "The Song of Achilles",
			Author:       "Madeline Miller",
			Narrator:     "Frazer Douglas",
			Description:  "A tale of gods, kings, immortal fame and the human heart...",
			DurationSec:  41400,  // 11.5 hours
			ProgressSec:  39200,  // 95% complete
			LastPlayedAt: &yesterday,
		},

		// Completed - 3 books
		{
			Title:        "Harry Potter and the Sorcerer's Stone",
			Author:       "J.K. Rowling",
			Narrator:     "Jim Dale",
			Description:  "The story of Harry Potter, a young wizard who discovers his magical heritage...",
			SeriesInfo:   `{"name":"Harry Potter","sequence":1}`,
			DurationSec:  28800, // 8 hours
			ProgressSec:  28800, // 100% complete
			IsFavorite:   true,
			LastPlayedAt: &lastWeek,
		},
		{
			Title:        "The Hobbit",
			Author:       "J.R.R. Tolkien",
			Narrator:     "Andy Serkis",
			Description:  "Bilbo Baggins is swept into an epic quest to reclaim the lost Dwarf Kingdom...",
			DurationSec:  39600, // 11 hours
			ProgressSec:  39600, // 100% complete
			LastPlayedAt: &lastMonth,
		},
		{
			Title:        "The Lord of the Rings",
			Author:       "J.R.R. Tolkien",
			Narrator:     "Andy Serkis",
			Description:  "An epic high fantasy novel...",
			DurationSec:  54000, // 15 hours
			ProgressSec:  54000, // 100% complete
			IsFavorite:   true,
			LastPlayedAt: &lastWeek,
		},

		// Additional books for variety
		{
			Title:       "The Martian",
			Author:      "Andy Weir",
			Narrator:    "R.C. Bray",
			Description: "Six days ago, astronaut Mark Watney became one of the first people to walk on Mars...",
			DurationSec: 37800, // 10.5 hours
		},
		{
			Title:        "1984",
			Author:       "George Orwell",
			Narrator:     "Simon Prebble",
			Description:  "A dystopian social science fiction novel...",
			DurationSec:  39600,  // 11 hours
			ProgressSec:  7920,   // 20% complete
			LastPlayedAt: &lastWeek,
		},
	}
}

func getNonfictionBooks() []TestBook {
	now := time.Now()
	yesterday := now.Add(-24 * time.Hour)
	lastWeek := now.Add(-7 * 24 * time.Hour)
	lastMonth := now.Add(-30 * 24 * time.Hour)

	return []TestBook{
		// Self-help & Business
		{
			Title:       "Atomic Habits",
			Author:      "James Clear",
			Narrator:    "James Clear",
			Description: "An easy and proven way to build good habits and break bad ones.",
			DurationSec: 18000, // 5 hours
		},
		{
			Title:        "Sapiens",
			Author:       "Yuval Noah Harari",
			Narrator:     "Derek Perkins",
			Description:  "A brief history of humankind...",
			DurationSec:  54000,  // 15 hours
			ProgressSec:  27000,  // 50% complete
			LastPlayedAt: &yesterday,
		},
		{
			Title:       "Thinking, Fast and Slow",
			Author:      "Daniel Kahneman",
			Narrator:    "Patrick Egan",
			Description: "A groundbreaking tour of the mind and explains the two systems that drive the way we think.",
			DurationSec: 72000, // 20 hours
		},
		{
			Title:        "The 7 Habits of Highly Effective People",
			Author:       "Stephen R. Covey",
			Narrator:     "Stephen R. Covey",
			Description:  "A holistic, integrated, principle-centered approach for solving personal and professional problems.",
			DurationSec:  54000,  // 15 hours
			ProgressSec:  54000,  // 100% complete
			IsFavorite:   true,
			LastPlayedAt: &lastMonth,
		},
		{
			Title:       "Range",
			Author:      "David Epstein",
			Narrator:    "Will Damron",
			Description: "Why generalists triumph in a specialized world.",
			DurationSec: 36000, // 10 hours
		},

		// Memoir & Biography
		{
			Title:       "Educated",
			Author:      "Tara Westover",
			Narrator:    "Julia Whelan",
			Description: "A memoir about a young woman who leaves her survivalist family...",
			DurationSec: 43200, // 12 hours
		},
		{
			Title:        "Shoe Dog",
			Author:       "Phil Knight",
			Narrator:     "Norbert Leo Butz, Phil Knight",
			Description:  "The memoir of Nike's founder...",
			DurationSec:  46800, // 13 hours
			ProgressSec:  46800, // 100% complete
			IsFavorite:   true,
			LastPlayedAt: &lastWeek,
		},
		{
			Title:       "Steve Jobs",
			Author:      "Walter Isaacson",
			Narrator:    "Dylan Baker",
			Description: "The exclusive biography of Steve Jobs.",
			DurationSec: 90000, // 25 hours
		},

		// Science & Technology
		{
			Title:        "A Brief History of Time",
			Author:       "Stephen Hawking",
			Narrator:     "Michael Jackson",
			Description:  "From the Big Bang to Black Holes...",
			DurationSec:  21600,  // 6 hours
			ProgressSec:  10800,  // 50% complete
			IsFavorite:   true,
			LastPlayedAt: &lastWeek,
		},
		{
			Title:       "The Innovators",
			Author:      "Walter Isaacson",
			Narrator:    "Dennis Boutsikaris",
			Description: "How a group of hackers, geniuses, and geeks created the digital revolution.",
			DurationSec: 61200, // 17 hours
		},
	}
}