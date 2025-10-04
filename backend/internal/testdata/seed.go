package testdata

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
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

	// All users have access to all libraries (no access control needed)

	// Create fiction books
	fictionBooks := getFictionBooks()
	for i, book := range fictionBooks {
		_, err := createTestBook(ctx, db, fictionLibraryID, fictionPathID, userID, book)
		if err != nil {
			return fmt.Errorf("failed to create fiction book %d: %w", i, err)
		}
	}

	// Create non-fiction books
	nonfictionBooks := getNonfictionBooks()
	for i, book := range nonfictionBooks {
		_, err := createTestBook(ctx, db, nonfictionLibraryID, nonfictionPathID, userID, book)
		if err != nil {
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

	// No user_library_access table to clean up

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

func generateAPIKey() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func getOrCreateTestUser(ctx context.Context, db *sql.DB) (string, error) {
	// Generate bcrypt hashes for passwords
	adminPasswordHash, err := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash admin password: %w", err)
	}
	userPasswordHash, err := bcrypt.GenerateFromPassword([]byte("user"), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash user password: %w", err)
	}

	// Create admin user
	var adminID string
	err = db.QueryRowContext(ctx, `SELECT id FROM users WHERE username = 'admin' LIMIT 1`).Scan(&adminID)
	if err != nil {
		// Admin doesn't exist, create it
		adminID = uuid.NewString()
		adminAPIKey, _ := generateAPIKey()
		now := time.Now().UTC().Format(time.RFC3339)
		_, err = db.ExecContext(ctx, `
			INSERT INTO users (id, username, password_hash, is_admin, api_key, created_at)
			VALUES (?, ?, ?, 1, ?, ?)
		`, adminID, "admin", string(adminPasswordHash), adminAPIKey, now)
		if err != nil {
			return "", fmt.Errorf("failed to create admin user: %w", err)
		}
		fmt.Printf("📝 Created admin user: %s\n", adminID)
	} else {
		// Admin exists, update password to "admin"
		adminAPIKey, _ := generateAPIKey()
		db.ExecContext(ctx, `UPDATE users SET password_hash = ?, api_key = ? WHERE id = ?`, string(adminPasswordHash), adminAPIKey, adminID)
		fmt.Printf("📝 Updated admin user: %s\n", adminID)
	}
	fmt.Println("   Login with: username=admin, password=admin")

	// Create regular user
	var regularUserID string
	err = db.QueryRowContext(ctx, `SELECT id FROM users WHERE username = 'user' LIMIT 1`).Scan(&regularUserID)
	if err != nil {
		// Regular user doesn't exist, create it
		regularUserID = uuid.NewString()
		userAPIKey, _ := generateAPIKey()
		now := time.Now().UTC().Format(time.RFC3339)
		_, err = db.ExecContext(ctx, `
			INSERT INTO users (id, username, password_hash, is_admin, api_key, created_at)
			VALUES (?, ?, ?, 0, ?, ?)
		`, regularUserID, "user", string(userPasswordHash), userAPIKey, now)
		if err != nil {
			return "", fmt.Errorf("failed to create regular user: %w", err)
		}
		fmt.Printf("📝 Created regular user: %s\n", regularUserID)
	} else {
		// Regular user exists, update password
		userAPIKey, _ := generateAPIKey()
		db.ExecContext(ctx, `UPDATE users SET password_hash = ?, api_key = ? WHERE id = ?`, string(userPasswordHash), userAPIKey, regularUserID)
		fmt.Printf("📝 Updated regular user: %s\n", regularUserID)
	}
	fmt.Println("   Login with: username=user, password=user")

	// Return admin ID for test data creation
	return adminID, nil
}

func createTestBook(ctx context.Context, db *sql.DB, libraryID, libraryPathID, userID string, book TestBook) (string, error) {
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
		INSERT INTO audiobook_metadata_agent (
			id, title, subtitle, author, narrator, description, cover_url, series_info,
			source, created_at, updated_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, metadataID, book.Title, subtitle, book.Author, narrator, description, coverURL, seriesInfo, "seed", now, now)
	if err != nil {
		return "", err
	}

	// Create audiobook
	audiobookID := uuid.NewString()
	assetPath := fmt.Sprintf("/tmp/test-audiobooks/%s", audiobookID)
	_, err = db.ExecContext(ctx, `
		INSERT INTO audiobooks (id, library_id, library_path_id, metadata_id, asset_path, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, audiobookID, libraryID, libraryPathID, metadataID, assetPath, now, now)
	if err != nil {
		return "", err
	}

	// Create media file (single file per book for simplicity)
	mediaFileID := uuid.NewString()
	_, err = db.ExecContext(ctx, `
		INSERT INTO media_files (id, audiobook_id, filename, duration_sec, mime_type)
		VALUES (?, ?, ?, ?, ?)
	`, mediaFileID, audiobookID, "audiobook.m4b", book.DurationSec, "audio/x-m4b")
	if err != nil {
		return "", err
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
			return "", err
		}
	}

	fmt.Printf("  ✓ Created: %s by %s\n", book.Title, book.Author)
	return audiobookID, nil
}

func getFictionBooks() []TestBook {
	now := time.Now()
	yesterday := now.Add(-24 * time.Hour)
	twoDaysAgo := now.Add(-48 * time.Hour)
	lastWeek := now.Add(-7 * 24 * time.Hour)
	lastMonth := now.Add(-30 * 24 * time.Hour)

	return []TestBook{
		// The Expanse series (5 books - completed series)
		{
			Title:        "Leviathan Wakes",
			Author:       "James S.A. Corey",
			Narrator:     "Jefferson Mays",
			Description:  "The first book in The Expanse series...",
			SeriesInfo:   `{"name":"The Expanse","sequence":1}`,
			DurationSec:  62640, // 17.4 hours
			ProgressSec:  62640, // 100% complete
			IsFavorite:   true,
			LastPlayedAt: &lastMonth,
		},
		{
			Title:        "Caliban's War",
			Author:       "James S.A. Corey",
			Narrator:     "Jefferson Mays",
			Description:  "The second book in The Expanse series...",
			SeriesInfo:   `{"name":"The Expanse","sequence":2}`,
			DurationSec:  74520, // 20.7 hours
			ProgressSec:  74520, // 100% complete
			LastPlayedAt: &lastMonth,
		},
		{
			Title:        "Abaddon's Gate",
			Author:       "James S.A. Corey",
			Narrator:     "Jefferson Mays",
			Description:  "The third book in The Expanse series...",
			SeriesInfo:   `{"name":"The Expanse","sequence":3}`,
			DurationSec:  70200, // 19.5 hours
			ProgressSec:  35100, // 50% complete
			IsFavorite:   true,
			LastPlayedAt: &yesterday,
		},
		{
			Title:       "Cibola Burn",
			Author:      "James S.A. Corey",
			Narrator:    "Jefferson Mays",
			Description: "The fourth book in The Expanse series...",
			SeriesInfo:  `{"name":"The Expanse","sequence":4}`,
			DurationSec: 73800, // 20.5 hours
		},
		{
			Title:       "Nemesis Games",
			Author:      "James S.A. Corey",
			Narrator:    "Jefferson Mays",
			Description: "The fifth book in The Expanse series...",
			SeriesInfo:  `{"name":"The Expanse","sequence":5}`,
			DurationSec: 68400, // 19 hours
		},

		// The Kingkiller Chronicle (2 books)
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
			Title:       "The Wise Man's Fear",
			Author:      "Patrick Rothfuss",
			Narrator:    "Nick Podehl",
			Description: "The second day of the story of Kvothe's life...",
			SeriesInfo:  `{"name":"The Kingkiller Chronicle","sequence":2}`,
			DurationSec: 151200, // 42 hours
		},

		// The Stormlight Archive (3 books)
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
			Title:        "Words of Radiance",
			Author:       "Brandon Sanderson",
			Narrator:     "Michael Kramer, Kate Reading",
			Description:  "The second book in The Stormlight Archive...",
			SeriesInfo:   `{"name":"The Stormlight Archive","sequence":2}`,
			DurationSec:  172800, // 48 hours
			ProgressSec:  43200,  // 25% complete
			LastPlayedAt: &twoDaysAgo,
		},
		{
			Title:       "Oathbringer",
			Author:      "Brandon Sanderson",
			Narrator:    "Michael Kramer, Kate Reading",
			Description: "The third book in The Stormlight Archive...",
			SeriesInfo:  `{"name":"The Stormlight Archive","sequence":3}`,
			DurationSec: 198000, // 55 hours
		},

		// Harry Potter (2 books for now)
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
			Title:        "Harry Potter and the Chamber of Secrets",
			Author:       "J.K. Rowling",
			Narrator:     "Jim Dale",
			Description:  "Harry's second year at Hogwarts...",
			SeriesInfo:   `{"name":"Harry Potter","sequence":2}`,
			DurationSec:  32400, // 9 hours
			ProgressSec:  32400, // 100% complete
			IsFavorite:   true,
			LastPlayedAt: &lastWeek,
		},

		// Standalone books
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
			Title:        "Dune",
			Author:       "Frank Herbert",
			Narrator:     "Scott Brick",
			Description:  "Set on the desert planet Arrakis, Dune is the story of Paul Atreides...",
			DurationSec:  75600,  // 21 hours
			ProgressSec:  37800,  // 50% complete
			LastPlayedAt: &twoDaysAgo,
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