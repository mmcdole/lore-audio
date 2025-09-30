package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/flix-audio/backend/internal/models"
)

// Repository wraps database access for the audiobook domain.
type Repository struct {
	db *sql.DB
}

// New creates a new Repository.
func New(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// CreateAudiobook persists an audiobook, its media entries, and default user data.
func (r *Repository) CreateAudiobook(ctx context.Context, audiobook *models.Audiobook, media []models.MediaFile, userID string) error {
	now := time.Now().UTC()
	audiobook.CreatedAt = now
	audiobook.UpdatedAt = now

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	_, err = tx.ExecContext(ctx, `
        INSERT INTO audiobooks (id, library_id, library_path_id, metadata_id, asset_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, audiobook.ID, sqlNullString(audiobook.LibraryID), audiobook.LibraryPathID, sqlNullString(audiobook.MetadataID), audiobook.AssetPath, audiobook.CreatedAt.Format(time.RFC3339), audiobook.UpdatedAt.Format(time.RFC3339))
	if err != nil {
		return err
	}

	for _, mf := range media {
		_, err = tx.ExecContext(ctx, `
            INSERT INTO media_files (id, audiobook_id, filename, duration_sec, mime_type)
            VALUES (?, ?, ?, ?, ?)
        `, mf.ID, mf.AudiobookID, mf.Filename, mf.DurationSec, mf.MimeType)
		if err != nil {
			return err
		}
	}

	// Only create user data if userID is provided
	if userID != "" {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO user_audiobook_data (user_id, audiobook_id, progress_sec, is_favorite, last_played_at)
			VALUES (?, ?, ?, ?, NULL)
			ON CONFLICT(user_id, audiobook_id) DO UPDATE SET progress_sec = excluded.progress_sec
		`, userID, audiobook.ID, 0, 0)
		if err != nil {
			return err
		}
	}

	if err = tx.Commit(); err != nil {
		return err
	}

	return nil
}

// ListAudiobooks retrieves all audiobooks, including linked metadata and user data.
func (r *Repository) ListAudiobooks(ctx context.Context, userID string) ([]models.Audiobook, error) {
	rows, err := r.db.QueryContext(ctx, `
        SELECT a.id, a.library_id, a.metadata_id, a.asset_path, a.library_path_id, a.created_at, a.updated_at,
               m.id, m.title, m.subtitle, m.author, m.narrator, m.description,
               m.cover_url, m.series_info, m.release_date,
               u.user_id, u.progress_sec, u.is_favorite, u.last_played_at
        FROM audiobooks a
        LEFT JOIN book_metadata m ON m.id = a.metadata_id
        LEFT JOIN user_audiobook_data u ON u.audiobook_id = a.id AND u.user_id = ?
        ORDER BY a.created_at DESC
    `, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var audiobooks []models.Audiobook

	for rows.Next() {
		var ab models.Audiobook
		var createdAt, updatedAt string
		var metaRow models.BookMetadata
		var subtitle, narrator, description, coverURL, seriesInfo, releaseDate sql.NullString
		var metadataID sql.NullString
		var libraryID sql.NullString
		var userIDVal, lastPlayedAt sql.NullString
		var progress sql.NullFloat64
		var favorite sql.NullInt64

		if err := rows.Scan(
			&ab.ID, &libraryID, &metadataID, &ab.AssetPath, &ab.LibraryPathID, &createdAt, &updatedAt,
			&metaRow.ID, &metaRow.Title, &subtitle, &metaRow.Author, &narrator, &description,
			&coverURL, &seriesInfo, &releaseDate,
			&userIDVal, &progress, &favorite, &lastPlayedAt,
		); err != nil {
			return nil, err
		}

		ab.LibraryID = nullableString(libraryID)
		ab.MetadataID = nullableString(metadataID)
		ab.CreatedAt = parseTime(createdAt)
		ab.UpdatedAt = parseTime(updatedAt)

		if metaRow.ID != "" {
			meta := metaRow
			meta.Subtitle = nullableString(subtitle)
			meta.Narrator = nullableString(narrator)
			meta.Description = nullableString(description)
			meta.CoverURL = nullableString(coverURL)
			meta.SeriesInfo = nullableString(seriesInfo)
			meta.ReleaseDate = nullableString(releaseDate)
			if strings.TrimSpace(meta.Title) != "" {
				ab.Metadata = &meta
			}
		}

		if userIDVal.Valid {
			ud := models.UserAudiobookData{
				UserID:      userIDVal.String,
				AudiobookID: ab.ID,
				ProgressSec: progress.Float64,
				IsFavorite:  favorite.Int64 == 1,
			}
			if lastPlayedAt.Valid && lastPlayedAt.String != "" {
				t := parseTime(lastPlayedAt.String)
				ud.LastPlayedAt = &t
			}
			ab.UserData = &ud
		}

		audiobooks = append(audiobooks, ab)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return audiobooks, nil
}

// GetAudiobook fetches a single audiobook with metadata, media, and user data.
func (r *Repository) GetAudiobook(ctx context.Context, id, userID string) (*models.Audiobook, error) {
	row := r.db.QueryRowContext(ctx, `
        SELECT a.id, a.library_id, a.metadata_id, a.asset_path, a.library_path_id, a.created_at, a.updated_at,
               m.id, m.title, m.subtitle, m.author, m.narrator, m.description,
               m.cover_url, m.series_info, m.release_date,
               u.user_id, u.progress_sec, u.is_favorite, u.last_played_at
        FROM audiobooks a
        LEFT JOIN book_metadata m ON m.id = a.metadata_id
        LEFT JOIN user_audiobook_data u ON u.audiobook_id = a.id AND u.user_id = ?
        WHERE a.id = ?
    `, userID, id)

	var ab models.Audiobook
	var createdAt, updatedAt string
	var metadata models.BookMetadata
	var subtitle, narrator, description, coverURL, seriesInfo, releaseDate sql.NullString
	var metadataID sql.NullString
	var libraryID sql.NullString
	var userIDVal, lastPlayedAt sql.NullString
	var progress sql.NullFloat64
	var favorite sql.NullInt64

	err := row.Scan(
		&ab.ID, &libraryID, &metadataID, &ab.AssetPath, &ab.LibraryPathID, &createdAt, &updatedAt,
		&metadata.ID, &metadata.Title, &subtitle, &metadata.Author, &narrator, &description,
		&coverURL, &seriesInfo, &releaseDate,
		&userIDVal, &progress, &favorite, &lastPlayedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	if err != nil {
		return nil, err
	}

	ab.LibraryID = nullableString(libraryID)
	ab.MetadataID = nullableString(metadataID)
	ab.CreatedAt = parseTime(createdAt)
	ab.UpdatedAt = parseTime(updatedAt)

	if metadata.ID != "" {
		metadata.Subtitle = nullableString(subtitle)
		metadata.Narrator = nullableString(narrator)
		metadata.Description = nullableString(description)
		metadata.CoverURL = nullableString(coverURL)
		metadata.SeriesInfo = nullableString(seriesInfo)
		metadata.ReleaseDate = nullableString(releaseDate)
		ab.Metadata = &metadata
	}

	if userIDVal.Valid {
		ud := models.UserAudiobookData{
			UserID:      userIDVal.String,
			AudiobookID: ab.ID,
			ProgressSec: progress.Float64,
			IsFavorite:  favorite.Int64 == 1,
		}
		if lastPlayedAt.Valid && lastPlayedAt.String != "" {
			t := parseTime(lastPlayedAt.String)
			ud.LastPlayedAt = &t
		}
		ab.UserData = &ud
	}

	media, err := r.mediaFiles(ctx, ab.ID)
	if err != nil {
		return nil, err
	}
	ab.MediaFiles = media

	return &ab, nil
}

// DeleteAudiobook removes the audiobook and cascades to related tables.
func (r *Repository) DeleteAudiobook(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM audiobooks WHERE id = ?`, id)
	return err
}

// GetMediaFileWithAudiobook fetches a media file alongside its parent audiobook.
func (r *Repository) GetMediaFileWithAudiobook(ctx context.Context, fileID string) (*models.MediaFile, *models.Audiobook, error) {
	row := r.db.QueryRowContext(ctx, `
        SELECT mf.id, mf.audiobook_id, mf.filename, mf.duration_sec, mf.mime_type,
               a.id, a.asset_path
        FROM media_files mf
        INNER JOIN audiobooks a ON a.id = mf.audiobook_id
        WHERE mf.id = ?
    `, fileID)

	var media models.MediaFile
	var audiobook models.Audiobook

	if err := row.Scan(
		&media.ID, &media.AudiobookID, &media.Filename, &media.DurationSec, &media.MimeType,
		&audiobook.ID, &audiobook.AssetPath,
	); err != nil {
		return nil, nil, err
	}

	return &media, &audiobook, nil
}

// UpsertMetadata inserts or updates book metadata records.
func (r *Repository) UpsertMetadata(ctx context.Context, meta *models.BookMetadata) error {
	_, err := r.db.ExecContext(ctx, `
        INSERT INTO book_metadata (id, title, subtitle, author, narrator, description, cover_url, series_info, release_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            subtitle = excluded.subtitle,
            author = excluded.author,
            narrator = excluded.narrator,
            description = excluded.description,
            cover_url = excluded.cover_url,
            series_info = excluded.series_info,
            release_date = excluded.release_date
    `,
		meta.ID,
		meta.Title,
		nullable(meta.Subtitle),
		meta.Author,
		nullable(meta.Narrator),
		nullable(meta.Description),
		nullable(meta.CoverURL),
		nullable(meta.SeriesInfo),
		nullable(meta.ReleaseDate),
	)
	return err
}

// GetMetadata retrieves a metadata entry by ID.
func (r *Repository) GetMetadata(ctx context.Context, id string) (*models.BookMetadata, error) {
	row := r.db.QueryRowContext(ctx, `
        SELECT id, title, subtitle, author, narrator, description, cover_url, series_info, release_date
        FROM book_metadata
        WHERE id = ?
    `, id)

	var meta models.BookMetadata
	var subtitle, narrator, description, coverURL, seriesInfo, releaseDate sql.NullString
	if err := row.Scan(&meta.ID, &meta.Title, &subtitle, &meta.Author, &narrator, &description, &coverURL, &seriesInfo, &releaseDate); err != nil {
		return nil, err
	}

	meta.Subtitle = nullableString(subtitle)
	meta.Narrator = nullableString(narrator)
	meta.Description = nullableString(description)
	meta.CoverURL = nullableString(coverURL)
	meta.SeriesInfo = nullableString(seriesInfo)
	meta.ReleaseDate = nullableString(releaseDate)
	return &meta, nil
}

// LinkAudiobookMetadata sets the metadata_id column for an audiobook.
func (r *Repository) LinkAudiobookMetadata(ctx context.Context, audiobookID, metadataID string) error {
	_, err := r.db.ExecContext(ctx, `
        UPDATE audiobooks
        SET metadata_id = ?, updated_at = ?
        WHERE id = ?
    `, metadataID, time.Now().UTC().Format(time.RFC3339), audiobookID)
	return err
}

// UnlinkAudiobookMetadata clears the metadata association for an audiobook.
func (r *Repository) UnlinkAudiobookMetadata(ctx context.Context, audiobookID string) error {
	_, err := r.db.ExecContext(ctx, `
        UPDATE audiobooks
        SET metadata_id = NULL, updated_at = ?
        WHERE id = ?
    `, time.Now().UTC().Format(time.RFC3339), audiobookID)
	return err
}

// UpdateUserProgress records listening progress for a user/audiobook pair.
func (r *Repository) UpdateUserProgress(ctx context.Context, userID, audiobookID string, progressSec float64, lastPlayedAt *time.Time) (*models.UserAudiobookData, error) {
	var lastPlayed string
	if lastPlayedAt != nil {
		lastPlayed = lastPlayedAt.UTC().Format(time.RFC3339)
	}
	_, err := r.db.ExecContext(ctx, `
        INSERT INTO user_audiobook_data (user_id, audiobook_id, progress_sec, is_favorite, last_played_at)
        VALUES (?, ?, ?, 0, ?)
        ON CONFLICT(user_id, audiobook_id) DO UPDATE SET
            progress_sec = excluded.progress_sec,
            last_played_at = excluded.last_played_at
    `, userID, audiobookID, progressSec, nullable(&lastPlayed))
	if err != nil {
		return nil, err
	}
	return r.fetchUserData(ctx, userID, audiobookID)
}

// SetUserFavorite toggles the favorite flag for a user/audiobook pair.
func (r *Repository) SetUserFavorite(ctx context.Context, userID, audiobookID string, isFavorite bool) (*models.UserAudiobookData, error) {
	fav := 0
	if isFavorite {
		fav = 1
	}
	_, err := r.db.ExecContext(ctx, `
        INSERT INTO user_audiobook_data (user_id, audiobook_id, progress_sec, is_favorite, last_played_at)
        VALUES (?, ?, 0, ?, NULL)
        ON CONFLICT(user_id, audiobook_id) DO UPDATE SET
            is_favorite = excluded.is_favorite
    `, userID, audiobookID, fav)
	if err != nil {
		return nil, err
	}
	return r.fetchUserData(ctx, userID, audiobookID)
}

func (r *Repository) fetchUserData(ctx context.Context, userID, audiobookID string) (*models.UserAudiobookData, error) {
	row := r.db.QueryRowContext(ctx, `
        SELECT user_id, audiobook_id, progress_sec, is_favorite, last_played_at
        FROM user_audiobook_data
        WHERE user_id = ? AND audiobook_id = ?
    `, userID, audiobookID)

	var data models.UserAudiobookData
	var lastPlayed sql.NullString
	var favorite int
	if err := row.Scan(&data.UserID, &data.AudiobookID, &data.ProgressSec, &favorite, &lastPlayed); err != nil {
		return nil, err
	}
	data.IsFavorite = favorite == 1
	if lastPlayed.Valid && lastPlayed.String != "" {
		t := parseTime(lastPlayed.String)
		data.LastPlayedAt = &t
	}
	return &data, nil
}

func (r *Repository) mediaFiles(ctx context.Context, audiobookID string) ([]models.MediaFile, error) {
	rows, err := r.db.QueryContext(ctx, `
        SELECT id, audiobook_id, filename, duration_sec, mime_type
        FROM media_files
        WHERE audiobook_id = ?
        ORDER BY filename
    `, audiobookID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var media []models.MediaFile
	for rows.Next() {
		var mf models.MediaFile
		if err := rows.Scan(&mf.ID, &mf.AudiobookID, &mf.Filename, &mf.DurationSec, &mf.MimeType); err != nil {
			return nil, err
		}
		media = append(media, mf)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Apply natural sort to handle numeric sequences properly
	naturalSort(media)
	return media, nil
}

func nullableString(ns sql.NullString) *string {
	if ns.Valid {
		val := ns.String
		return &val
	}
	return nil
}

func nullable(ptr *string) interface{} {
	if ptr == nil {
		return nil
	}
	if *ptr == "" {
		return nil
	}
	return *ptr
}

func parseTime(raw string) time.Time {
	if raw == "" {
		return time.Time{}
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t
	}
	return time.Time{}
}

// UserHasAudiobookInLibrary checks if a user has interacted with an audiobook (has data in user_audiobook_data).
func (r *Repository) UserHasAudiobookInLibrary(ctx context.Context, userID, audiobookID string) (bool, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM user_audiobook_data
		WHERE user_id = ? AND audiobook_id = ?
	`, userID, audiobookID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// ListCatalogAudiobooks returns all audiobooks in the global catalog with user library status.
func (r *Repository) ListCatalogAudiobooks(ctx context.Context, userID string, libraryID *string, offset, limit int) ([]models.Audiobook, int, error) {
	// First get total count
	var total int
	countQuery := "SELECT COUNT(*) FROM audiobooks"
	var countArgs []interface{}
	if libraryID != nil && *libraryID != "" {
		countQuery += " WHERE library_id = ?"
		countArgs = append(countArgs, *libraryID)
	}

	err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Then get the audiobooks with file count and total duration
	baseQuery := `
		SELECT a.id, a.library_id, a.metadata_id, a.asset_path, a.library_path_id, a.created_at, a.updated_at,
		       m.id, m.title, m.subtitle, m.author, m.narrator, m.description,
		       m.cover_url, m.series_info, m.release_date,
		       COALESCE(mf_stats.file_count, 0) as file_count,
		       COALESCE(mf_stats.total_duration, 0) as total_duration_sec
		FROM audiobooks a
		LEFT JOIN book_metadata m ON m.id = a.metadata_id
		LEFT JOIN (
			SELECT audiobook_id,
			       COUNT(*) as file_count,
			       SUM(duration_sec) as total_duration
			FROM media_files
			GROUP BY audiobook_id
		) mf_stats ON mf_stats.audiobook_id = a.id
`
	queryArgs := []interface{}{}
	if libraryID != nil && *libraryID != "" {
		baseQuery += "\nWHERE a.library_id = ?"
		queryArgs = append(queryArgs, *libraryID)
	}

	baseQuery += "\nORDER BY a.created_at DESC\nLIMIT ? OFFSET ?"
	queryArgs = append(queryArgs, limit, offset)

	rows, err := r.db.QueryContext(ctx, baseQuery, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var audiobooks []models.Audiobook
	for rows.Next() {
		var ab models.Audiobook
		var createdAt, updatedAt string
		var metaRow models.BookMetadata
		var subtitle, narrator, description, coverURL, seriesInfo, releaseDate sql.NullString
		var metadataID sql.NullString
		var libraryID sql.NullString
		var fileCount int
		var totalDuration float64

		if err := rows.Scan(
			&ab.ID, &libraryID, &metadataID, &ab.AssetPath, &ab.LibraryPathID, &createdAt, &updatedAt,
			&metaRow.ID, &metaRow.Title, &subtitle, &metaRow.Author, &narrator, &description,
			&coverURL, &seriesInfo, &releaseDate,
			&fileCount, &totalDuration,
		); err != nil {
			return nil, 0, err
		}

		ab.LibraryID = nullableString(libraryID)
		ab.MetadataID = nullableString(metadataID)
		ab.CreatedAt = parseTime(createdAt)
		ab.UpdatedAt = parseTime(updatedAt)
		ab.FileCount = fileCount
		ab.TotalDurationSec = totalDuration
		if metaRow.ID != "" {
			meta := metaRow
			meta.Subtitle = nullableString(subtitle)
			meta.Narrator = nullableString(narrator)
			meta.Description = nullableString(description)
			meta.CoverURL = nullableString(coverURL)
			meta.SeriesInfo = nullableString(seriesInfo)
			meta.ReleaseDate = nullableString(releaseDate)
			if strings.TrimSpace(meta.Title) != "" {
				ab.Metadata = &meta
			}
		}

		audiobooks = append(audiobooks, ab)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return audiobooks, total, nil
}

// ListUserLibraryAudiobooks returns audiobooks the user has interacted with (has user_audiobook_data).
func (r *Repository) ListUserLibraryAudiobooks(ctx context.Context, userID string, libraryID *string, offset, limit int) ([]models.Audiobook, int, error) {
	// First get total count
	var total int
	countQuery := `
		SELECT COUNT(*) FROM audiobooks a
		WHERE 1=1
	`
	var countArgs []interface{}
	if libraryID != nil && *libraryID != "" {
		countQuery += " AND a.library_id = ?"
		countArgs = append(countArgs, *libraryID)
	}

	err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Then get the audiobooks
	query := `
		SELECT a.id, a.library_id, a.metadata_id, a.asset_path, a.library_path_id, a.created_at, a.updated_at,
		       m.id, m.title, m.subtitle, m.author, m.narrator, m.description,
		       m.cover_url, m.series_info, m.release_date,
		       u.user_id, u.progress_sec, u.is_favorite, u.last_played_at,
		       COALESCE(mf_stats.file_count, 0) as file_count,
		       COALESCE(mf_stats.total_duration, 0) as total_duration_sec
		FROM audiobooks a
		LEFT JOIN book_metadata m ON m.id = a.metadata_id
		LEFT JOIN user_audiobook_data u ON u.audiobook_id = a.id AND u.user_id = ?
		LEFT JOIN (
			SELECT audiobook_id,
			       COUNT(*) as file_count,
			       SUM(duration_sec) as total_duration
			FROM media_files
			GROUP BY audiobook_id
		) mf_stats ON mf_stats.audiobook_id = a.id
		WHERE 1=1
`
	queryArgs := []interface{}{userID}
	if libraryID != nil && *libraryID != "" {
		query += " AND a.library_id = ?"
		queryArgs = append(queryArgs, *libraryID)
	}

	query += "\nORDER BY u.last_played_at DESC\nLIMIT ? OFFSET ?"
	queryArgs = append(queryArgs, limit, offset)

	rows, err := r.db.QueryContext(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var audiobooks []models.Audiobook
	for rows.Next() {
		var ab models.Audiobook
		var createdAt, updatedAt string
		var metaRow models.BookMetadata
		var metaID, title, author sql.NullString
		var subtitle, narrator, description, coverURL, seriesInfo, releaseDate sql.NullString
		var metadataID sql.NullString
		var libraryID sql.NullString
		var userIDVal, lastPlayedAt sql.NullString
		var progress sql.NullFloat64
		var favorite sql.NullInt64
		var fileCount int
		var totalDuration float64

		if err := rows.Scan(
			&ab.ID, &libraryID, &metadataID, &ab.AssetPath, &ab.LibraryPathID, &createdAt, &updatedAt,
			&metaID, &title, &subtitle, &author, &narrator, &description,
			&coverURL, &seriesInfo, &releaseDate,
			&userIDVal, &progress, &favorite, &lastPlayedAt,
			&fileCount, &totalDuration,
		); err != nil {
			return nil, 0, err
		}

		ab.LibraryID = nullableString(libraryID)
		ab.MetadataID = nullableString(metadataID)
		ab.CreatedAt = parseTime(createdAt)
		ab.UpdatedAt = parseTime(updatedAt)
		ab.FileCount = fileCount
		ab.TotalDurationSec = totalDuration

		if metaID.Valid && metaID.String != "" {
			metaRow.ID = metaID.String
			metaRow.Title = title.String
			metaRow.Author = author.String
			metaRow.Subtitle = nullableString(subtitle)
			metaRow.Narrator = nullableString(narrator)
			metaRow.Description = nullableString(description)
			metaRow.CoverURL = nullableString(coverURL)
			metaRow.SeriesInfo = nullableString(seriesInfo)
			metaRow.ReleaseDate = nullableString(releaseDate)
			if strings.TrimSpace(metaRow.Title) != "" {
				ab.Metadata = &metaRow
			}
		}

		// User data - only set if user has interacted with this book
		if userIDVal.Valid {
			ud := models.UserAudiobookData{
				UserID:      userIDVal.String,
				AudiobookID: ab.ID,
				ProgressSec: progress.Float64,
				IsFavorite:  favorite.Int64 == 1,
			}
			if lastPlayedAt.Valid && lastPlayedAt.String != "" {
				t := parseTime(lastPlayedAt.String)
				ud.LastPlayedAt = &t
			}
			ab.UserData = &ud
		}

		// Get media files
		media, err := r.mediaFiles(ctx, ab.ID)
		if err != nil {
			return nil, 0, err
		}
		ab.MediaFiles = media

		audiobooks = append(audiobooks, ab)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return audiobooks, total, nil
}

// SearchCatalogAudiobooks searches all audiobooks by title, author, or narrator.
// CountBooksInPath counts audiobooks with asset paths under the given path.
func (r *Repository) CountBooksInPath(ctx context.Context, path string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM audiobooks
		WHERE asset_path LIKE ? || '%'
	`, path).Scan(&count)
	return count, err
}

// GetAudiobookByPath retrieves an audiobook by its asset path.
func (r *Repository) GetAudiobookByPath(ctx context.Context, assetPath string) (*models.Audiobook, error) {
	var ab models.Audiobook
	var metadataID sql.NullString
	var libraryID sql.NullString
	var createdAt, updatedAt string

	err := r.db.QueryRowContext(ctx, `
		SELECT id, library_id, metadata_id, asset_path, library_path_id, created_at, updated_at
		FROM audiobooks
		WHERE asset_path = ?
	`, assetPath).Scan(&ab.ID, &libraryID, &metadataID, &ab.AssetPath, &ab.LibraryPathID, &createdAt, &updatedAt)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	ab.LibraryID = nullableString(libraryID)
	if metadataID.Valid {
		ab.MetadataID = &metadataID.String
	}

	// Parse timestamps
	if ab.CreatedAt, err = time.Parse(time.RFC3339, createdAt); err != nil {
		return nil, err
	}
	if ab.UpdatedAt, err = time.Parse(time.RFC3339, updatedAt); err != nil {
		return nil, err
	}

	return &ab, nil
}

func (r *Repository) SearchCatalogAudiobooks(ctx context.Context, userID, query string, libraryID *string, offset, limit int) ([]models.Audiobook, int, error) {
	// Build search pattern for LIKE queries
	searchPattern := "%" + query + "%"

	// First, get the total count
	countQuery := `
		SELECT COUNT(DISTINCT a.id)
		FROM audiobooks a
		LEFT JOIN book_metadata m ON m.id = a.metadata_id
		WHERE (m.title LIKE ? OR m.author LIKE ? OR m.narrator LIKE ?)
	`

	var total int
	var countArgs = []interface{}{searchPattern, searchPattern, searchPattern}
	if libraryID != nil && *libraryID != "" {
		countQuery += " AND a.library_id = ?"
		countArgs = append(countArgs, *libraryID)
	}

	err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Now get the actual results
	searchQuery := `
		SELECT a.id, a.library_id, a.metadata_id, a.asset_path, a.library_path_id, a.created_at, a.updated_at,
		       m.id, m.title, m.subtitle, m.author, m.narrator, m.description,
		       m.cover_url, m.series_info, m.release_date,
		       COALESCE(mf_stats.file_count, 0) as file_count,
		       COALESCE(mf_stats.total_duration, 0) as total_duration_sec
		FROM audiobooks a
		LEFT JOIN book_metadata m ON m.id = a.metadata_id
		LEFT JOIN (
			SELECT audiobook_id,
			       COUNT(*) as file_count,
			       SUM(duration_sec) as total_duration
			FROM media_files
			GROUP BY audiobook_id
		) mf_stats ON mf_stats.audiobook_id = a.id
		WHERE (m.title LIKE ? OR m.author LIKE ? OR m.narrator LIKE ?)
`

	queryArgs := []interface{}{searchPattern, searchPattern, searchPattern}
	if libraryID != nil && *libraryID != "" {
		searchQuery += " AND a.library_id = ?"
		queryArgs = append(queryArgs, *libraryID)
	}

	searchQuery += "\nORDER BY a.created_at DESC\nLIMIT ? OFFSET ?"
	queryArgs = append(queryArgs, limit, offset)

	rows, err := r.db.QueryContext(ctx, searchQuery, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var audiobooks []models.Audiobook

	for rows.Next() {
		var ab models.Audiobook
		var createdAt, updatedAt string
		var metaRow models.BookMetadata
		var subtitle, narrator, description, coverURL, seriesInfo, releaseDate sql.NullString
		var metaID sql.NullString
		var libraryID sql.NullString
		var fileCount int
		var totalDuration float64

		err := rows.Scan(
			&ab.ID, &libraryID, &metaID, &ab.AssetPath, &ab.LibraryPathID, &createdAt, &updatedAt,
			&metaRow.ID, &metaRow.Title, &subtitle, &metaRow.Author, &narrator, &description,
			&coverURL, &seriesInfo, &releaseDate,
			&fileCount, &totalDuration,
		)
		if err != nil {
			return nil, 0, err
		}

		ab.LibraryID = nullableString(libraryID)
		ab.CreatedAt = parseTime(createdAt)
		ab.UpdatedAt = parseTime(updatedAt)
		ab.FileCount = fileCount
		ab.TotalDurationSec = totalDuration

		if metaID.Valid && metaID.String != "" {
			ab.MetadataID = &metaID.String
			ab.Metadata = &metaRow

			if subtitle.Valid {
				ab.Metadata.Subtitle = &subtitle.String
			}
			if narrator.Valid {
				ab.Metadata.Narrator = &narrator.String
			}
			if description.Valid {
				ab.Metadata.Description = &description.String
			}
			if coverURL.Valid {
				ab.Metadata.CoverURL = &coverURL.String
			}
			if seriesInfo.Valid {
				ab.Metadata.SeriesInfo = &seriesInfo.String
			}
			if releaseDate.Valid {
				ab.Metadata.ReleaseDate = &releaseDate.String
			}
		}

		audiobooks = append(audiobooks, ab)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return audiobooks, total, nil
}

// naturalSort sorts media files using natural ordering for numeric sequences in filenames.
// This ensures "Chapter 1.mp3", "Chapter 2.mp3", "Chapter 10.mp3" are ordered correctly
// instead of lexicographically as "Chapter 1.mp3", "Chapter 10.mp3", "Chapter 2.mp3".
func naturalSort(media []models.MediaFile) {
	sort.Slice(media, func(i, j int) bool {
		return naturalLess(media[i].Filename, media[j].Filename)
	})
}

// naturalLess compares two filenames using natural ordering.
func naturalLess(a, b string) bool {
	// Simple natural sort implementation
	aLower := strings.ToLower(a)
	bLower := strings.ToLower(b)

	// Split into parts containing letters and numbers
	aParts := naturalSplit(aLower)
	bParts := naturalSplit(bLower)

	// Compare part by part
	for i := 0; i < len(aParts) && i < len(bParts); i++ {
		aPart := aParts[i]
		bPart := bParts[i]

		// Check if both parts are numeric
		aNum, aIsNum := parseNumber(aPart)
		bNum, bIsNum := parseNumber(bPart)

		if aIsNum && bIsNum {
			// Both are numbers, compare numerically
			if aNum != bNum {
				return aNum < bNum
			}
		} else {
			// At least one is not a number, compare lexicographically
			if aPart != bPart {
				return aPart < bPart
			}
		}
	}

	// If all compared parts are equal, shorter filename comes first
	return len(aParts) < len(bParts)
}

// naturalSplit splits a string into alternating text and numeric parts.
func naturalSplit(s string) []string {
	re := regexp.MustCompile(`(\d+|\D+)`)
	return re.FindAllString(s, -1)
}

// parseNumber attempts to parse a string as an integer.

func parseNumber(s string) (int, bool) {
	if num, err := strconv.Atoi(s); err == nil {
		return num, true
	}
	return 0, false
}

func (r *Repository) loadPathLibraries(ctx context.Context) (map[string][]models.LibrarySummary, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT ld.directory_id, l.id, l.name, l.display_name, l.type
		FROM library_directories ld
		JOIN libraries l ON l.id = ld.library_id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	mapping := make(map[string][]models.LibrarySummary)

	for rows.Next() {
		var directoryID, libraryID, name, displayName, libType string
		if err := rows.Scan(&directoryID, &libraryID, &name, &displayName, &libType); err != nil {
			return nil, err
		}

		mapping[directoryID] = append(mapping[directoryID], models.LibrarySummary{
			ID:          libraryID,
			Name:        name,
			DisplayName: displayName,
			Type:        libType,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return mapping, nil
}

func (r *Repository) librariesForPath(ctx context.Context, pathID string) ([]models.LibrarySummary, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT l.id, l.name, l.display_name, l.type
		FROM library_directories ld
		JOIN libraries l ON l.id = ld.library_id
		WHERE ld.directory_id = ?
		ORDER BY l.display_name ASC
	`, pathID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var libraries []models.LibrarySummary
	for rows.Next() {
		var lib models.LibrarySummary
		if err := rows.Scan(&lib.ID, &lib.Name, &lib.DisplayName, &lib.Type); err != nil {
			return nil, err
		}
		libraries = append(libraries, lib)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	return libraries, nil
}

func marshalLibrarySettings(settings map[string]interface{}) (*string, error) {
	if settings == nil || len(settings) == 0 {
		return nil, nil
	}

	encoded, err := json.Marshal(settings)
	if err != nil {
		return nil, err
	}
	result := string(encoded)
	return &result, nil
}

func unmarshalLibrarySettings(raw sql.NullString) (map[string]interface{}, error) {
	if !raw.Valid {
		return nil, nil
	}

	trimmed := strings.TrimSpace(raw.String)
	if trimmed == "" {
		return nil, nil
	}

	var settings map[string]interface{}
	if err := json.Unmarshal([]byte(trimmed), &settings); err != nil {
		return nil, err
	}
	return settings, nil
}

func (r *Repository) loadLibraryBookCounts(ctx context.Context) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT library_id, COUNT(*)
		FROM audiobooks
		WHERE library_id IS NOT NULL
		GROUP BY library_id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var libraryID string
		var count int
		if err := rows.Scan(&libraryID, &count); err != nil {
			return nil, err
		}
		counts[libraryID] = count
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return counts, nil
}

func (r *Repository) libraryBookCount(ctx context.Context, libraryID string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM audiobooks
		WHERE library_id = ?
	`, libraryID).Scan(&count)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, nil
		}
		return 0, err
	}
	return count, nil
}

// Library Management

// CreateLibrary creates a new logical library.
func (r *Repository) CreateLibrary(ctx context.Context, library *models.Library) error {
	if library == nil {
		return fmt.Errorf("library is nil")
	}

	if strings.TrimSpace(library.Type) == "" {
		library.Type = "audiobook"
	}

	now := time.Now().UTC()
	library.CreatedAt = now
	library.UpdatedAt = now

	settingsJSON, err := marshalLibrarySettings(library.Settings)
	if err != nil {
		return err
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO libraries (id, name, display_name, type, description, settings, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, library.ID, library.Name, library.DisplayName, library.Type,
		sqlNullString(library.Description), sqlNullString(settingsJSON),
		library.CreatedAt.Format(time.RFC3339), library.UpdatedAt.Format(time.RFC3339))
	return err
}

// ListLibraries returns all libraries with directory assignments and book counts.
func (r *Repository) ListLibraries(ctx context.Context) ([]models.Library, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, display_name, type, description, settings, created_at, updated_at
		FROM libraries
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var libraries []models.Library
	byID := make(map[string]*models.Library)

	for rows.Next() {
		var lib models.Library
		var description sql.NullString
		var settings sql.NullString
		var createdAt, updatedAt string

		if err := rows.Scan(&lib.ID, &lib.Name, &lib.DisplayName, &lib.Type, &description, &settings, &createdAt, &updatedAt); err != nil {
			return nil, err
		}

		lib.Description = nullableString(description)
		lib.Settings, err = unmarshalLibrarySettings(settings)
		if err != nil {
			return nil, err
		}
		lib.CreatedAt = parseTime(createdAt)
		lib.UpdatedAt = parseTime(updatedAt)

		libraries = append(libraries, lib)
		byID[lib.ID] = &libraries[len(libraries)-1]
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	counts, err := r.loadLibraryBookCounts(ctx)
	if err != nil {
		return nil, err
	}

	for id, count := range counts {
		if lib := byID[id]; lib != nil {
			lib.BookCount = count
		}
	}

	dirRows, err := r.db.QueryContext(ctx, `
		SELECT ld.library_id,
		       lp.id, lp.path, lp.name, lp.enabled, lp.created_at, lp.last_scanned_at,
		       COUNT(a.id) as book_count
		FROM library_directories ld
		JOIN library_paths lp ON lp.id = ld.directory_id
		LEFT JOIN audiobooks a ON a.library_id = ld.library_id AND a.library_path_id = lp.id
		GROUP BY ld.library_id, lp.id, lp.path, lp.name, lp.enabled, lp.created_at, lp.last_scanned_at
		ORDER BY lp.name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer dirRows.Close()

	for dirRows.Next() {
		var libraryID string
		var path models.LibraryPath
		var createdAt string
		var lastScanned sql.NullString

		if err := dirRows.Scan(&libraryID, &path.ID, &path.Path, &path.Name, &path.Enabled, &createdAt, &lastScanned, &path.BookCount); err != nil {
			return nil, err
		}

		path.CreatedAt = parseTime(createdAt)
		if lastScanned.Valid {
			scanned := parseTime(lastScanned.String)
			path.LastScannedAt = &scanned
		}

		if lib := byID[libraryID]; lib != nil {
			path.Libraries = []models.LibrarySummary{{
				ID:          lib.ID,
				Name:        lib.Name,
				DisplayName: lib.DisplayName,
				Type:        lib.Type,
			}}
			lib.Directories = append(lib.Directories, path)
		}
	}

	if err := dirRows.Err(); err != nil {
		return nil, err
	}

	return libraries, nil
}

// GetLibraryByID fetches a single library with its directories and statistics.
func (r *Repository) GetLibraryByID(ctx context.Context, id string) (*models.Library, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, name, display_name, type, description, settings, created_at, updated_at
		FROM libraries
		WHERE id = ?
	`, id)

	var lib models.Library
	var description sql.NullString
	var settings sql.NullString
	var createdAt, updatedAt string

	if err := row.Scan(&lib.ID, &lib.Name, &lib.DisplayName, &lib.Type, &description, &settings, &createdAt, &updatedAt); err != nil {
		return nil, err
	}

	lib.Description = nullableString(description)
	var err error
	lib.Settings, err = unmarshalLibrarySettings(settings)
	if err != nil {
		return nil, err
	}
	lib.CreatedAt = parseTime(createdAt)
	lib.UpdatedAt = parseTime(updatedAt)

	lib.BookCount, err = r.libraryBookCount(ctx, id)
	if err != nil {
		return nil, err
	}

	directories, err := r.ListLibraryDirectories(ctx, id)
	if err != nil {
		return nil, err
	}

	summary := models.LibrarySummary{
		ID:          lib.ID,
		Name:        lib.Name,
		DisplayName: lib.DisplayName,
		Type:        lib.Type,
	}
	for i := range directories {
		directories[i].Libraries = []models.LibrarySummary{summary}
	}
	lib.Directories = directories

	return &lib, nil
}

// UpdateLibrary updates mutable library fields.
func (r *Repository) UpdateLibrary(ctx context.Context, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		_, err := r.db.ExecContext(ctx, `
			UPDATE libraries SET updated_at = ? WHERE id = ?
		`, time.Now().UTC().Format(time.RFC3339), id)
		return err
	}

	setParts := []string{}
	args := []interface{}{}

	if v, ok := updates["name"]; ok {
		setParts = append(setParts, "name = ?")
		args = append(args, v)
	}
	if v, ok := updates["display_name"]; ok {
		setParts = append(setParts, "display_name = ?")
		args = append(args, v)
	}
	if v, ok := updates["type"]; ok {
		setParts = append(setParts, "type = ?")
		args = append(args, v)
	}

	if v, ok := updates["description"]; ok {
		var descPtr *string
		switch value := v.(type) {
		case string:
			descPtr = &value
		case *string:
			descPtr = value
		case nil:
			descPtr = nil
		default:
			return fmt.Errorf("unsupported description update type %T", v)
		}
		setParts = append(setParts, "description = ?")
		args = append(args, sqlNullString(descPtr))
	}

	if v, ok := updates["settings"]; ok {
		var settingsMap map[string]interface{}
		switch value := v.(type) {
		case map[string]interface{}:
			settingsMap = value
		case *map[string]interface{}:
			if value != nil {
				settingsMap = *value
			}
		case nil:
			settingsMap = nil
		default:
			return fmt.Errorf("unsupported settings update type %T", v)
		}

		settingsJSON, err := marshalLibrarySettings(settingsMap)
		if err != nil {
			return err
		}
		setParts = append(setParts, "settings = ?")
		args = append(args, sqlNullString(settingsJSON))
	}

	if len(setParts) == 0 {
		_, err := r.db.ExecContext(ctx, `
			UPDATE libraries SET updated_at = ? WHERE id = ?
		`, time.Now().UTC().Format(time.RFC3339), id)
		return err
	}

	setParts = append(setParts, "updated_at = ?")
	args = append(args, time.Now().UTC().Format(time.RFC3339))
	args = append(args, id)

	query := fmt.Sprintf("UPDATE libraries SET %s WHERE id = ?", strings.Join(setParts, ", "))
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// DeleteLibrary removes a library and cascades to its assignments.
func (r *Repository) DeleteLibrary(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM libraries WHERE id = ?`, id)
	return err
}

// SetLibraryDirectories replaces the directory assignments for a library.
func (r *Repository) SetLibraryDirectories(ctx context.Context, libraryID string, directoryIDs []string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM library_directories WHERE library_id = ?`, libraryID); err != nil {
		tx.Rollback()
		return err
	}

	if _, err := tx.ExecContext(ctx, `UPDATE audiobooks SET library_id = NULL WHERE library_id = ?`, libraryID); err != nil {
		tx.Rollback()
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	seen := make(map[string]struct{})

	for _, directoryID := range directoryIDs {
		directoryID = strings.TrimSpace(directoryID)
		if directoryID == "" {
			continue
		}
		if _, ok := seen[directoryID]; ok {
			continue
		}
		seen[directoryID] = struct{}{}

		if _, err := tx.ExecContext(ctx, `
			INSERT INTO library_directories (library_id, directory_id, created_at)
			VALUES (?, ?, ?)
		`, libraryID, directoryID, now); err != nil {
			tx.Rollback()
			return err
		}

		if _, err := tx.ExecContext(ctx, `
			UPDATE audiobooks
			SET library_id = ?
			WHERE library_path_id = ?
		`, libraryID, directoryID); err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit()
}

// ListLibraryDirectories returns the directories assigned to a library.
func (r *Repository) ListLibraryDirectories(ctx context.Context, libraryID string) ([]models.LibraryPath, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT lp.id, lp.path, lp.name, lp.enabled, lp.created_at, lp.last_scanned_at,
		       COUNT(a.id) as book_count
		FROM library_directories ld
		JOIN library_paths lp ON lp.id = ld.directory_id
		LEFT JOIN audiobooks a ON a.library_id = ld.library_id AND a.library_path_id = lp.id
		WHERE ld.library_id = ?
		GROUP BY lp.id, lp.path, lp.name, lp.enabled, lp.created_at, lp.last_scanned_at
		ORDER BY lp.name ASC
	`, libraryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []models.LibraryPath
	for rows.Next() {
		var path models.LibraryPath
		var createdAt string
		var lastScanned sql.NullString

		if err := rows.Scan(&path.ID, &path.Path, &path.Name, &path.Enabled, &createdAt, &lastScanned, &path.BookCount); err != nil {
			return nil, err
		}

		path.CreatedAt = parseTime(createdAt)
		if lastScanned.Valid {
			scanned := parseTime(lastScanned.String)
			path.LastScannedAt = &scanned
		}

		paths = append(paths, path)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return paths, nil
}

// Library Path Management

// CreateLibraryPath adds a new library path configuration.
func (r *Repository) CreateLibraryPath(ctx context.Context, libraryPath *models.LibraryPath) error {
	now := time.Now().UTC()
	libraryPath.CreatedAt = now

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO library_paths (id, path, name, enabled, created_at)
		VALUES (?, ?, ?, ?, ?)
	`, libraryPath.ID, libraryPath.Path, libraryPath.Name, libraryPath.Enabled, libraryPath.CreatedAt.Format(time.RFC3339))

	return err
}

// GetLibraryPaths retrieves all configured library paths.
func (r *Repository) GetLibraryPaths(ctx context.Context) ([]models.LibraryPath, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, path, name, enabled, created_at, last_scanned_at
		FROM library_paths
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []models.LibraryPath
	for rows.Next() {
		var path models.LibraryPath
		var createdAt string
		var lastScannedAt sql.NullString

		if err := rows.Scan(
			&path.ID, &path.Path, &path.Name, &path.Enabled, &createdAt, &lastScannedAt,
		); err != nil {
			return nil, err
		}

		path.CreatedAt = parseTime(createdAt)
		if lastScannedAt.Valid {
			scanned := parseTime(lastScannedAt.String)
			path.LastScannedAt = &scanned
		}

		paths = append(paths, path)
	}

	mapping, err := r.loadPathLibraries(ctx)
	if err != nil {
		return nil, err
	}

	for i := range paths {
		if libs, ok := mapping[paths[i].ID]; ok {
			paths[i].Libraries = libs
		}
	}

	return paths, nil
}

// GetLibraryPathByID retrieves a single library path by its identifier.
func (r *Repository) GetLibraryPathByID(ctx context.Context, id string) (*models.LibraryPath, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, path, name, enabled, created_at, last_scanned_at
		FROM library_paths
		WHERE id = ?
	`, id)

	var path models.LibraryPath
	var createdAt string
	var lastScanned sql.NullString

	if err := row.Scan(&path.ID, &path.Path, &path.Name, &path.Enabled, &createdAt, &lastScanned); err != nil {
		return nil, err
	}

	path.CreatedAt = parseTime(createdAt)
	if lastScanned.Valid {
		t := parseTime(lastScanned.String)
		path.LastScannedAt = &t
	}

	libraries, err := r.librariesForPath(ctx, id)
	if err != nil {
		return nil, err
	}
	path.Libraries = libraries

	return &path, nil
}

// Import Folder Management

// CreateImportFolder adds a new import folder configuration.
func (r *Repository) CreateImportFolder(ctx context.Context, importFolder *models.ImportFolder) error {
	now := time.Now().UTC()
	importFolder.CreatedAt = now

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO import_folders (id, path, name, enabled, created_at)
		VALUES (?, ?, ?, ?, ?)
	`, importFolder.ID, importFolder.Path, importFolder.Name, importFolder.Enabled, importFolder.CreatedAt.Format(time.RFC3339))

	return err
}

// GetImportFolders retrieves all configured import folders.
func (r *Repository) GetImportFolders(ctx context.Context) ([]models.ImportFolder, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, path, name, enabled, created_at
		FROM import_folders
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var folders []models.ImportFolder
	for rows.Next() {
		var folder models.ImportFolder
		var createdAt string

		if err := rows.Scan(
			&folder.ID, &folder.Path, &folder.Name, &folder.Enabled, &createdAt,
		); err != nil {
			return nil, err
		}

		folder.CreatedAt = parseTime(createdAt)
		folders = append(folders, folder)
	}

	return folders, nil
}

// GetImportFolderByID retrieves a single import folder by its identifier.
func (r *Repository) GetImportFolderByID(ctx context.Context, id string) (*models.ImportFolder, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, path, name, enabled, created_at
		FROM import_folders
		WHERE id = ?
	`, id)

	var folder models.ImportFolder
	var createdAt string

	if err := row.Scan(&folder.ID, &folder.Path, &folder.Name, &folder.Enabled, &createdAt); err != nil {
		return nil, err
	}

	folder.CreatedAt = parseTime(createdAt)
	return &folder, nil
}

// GetEnabledImportFolders returns only enabled import folders.
func (r *Repository) GetEnabledImportFolders(ctx context.Context) ([]models.ImportFolder, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, path, name, enabled, created_at
		FROM import_folders
		WHERE enabled = 1
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var folders []models.ImportFolder
	for rows.Next() {
		var folder models.ImportFolder
		var createdAt string

		if err := rows.Scan(
			&folder.ID, &folder.Path, &folder.Name, &folder.Enabled, &createdAt,
		); err != nil {
			return nil, err
		}

		folder.CreatedAt = parseTime(createdAt)
		folders = append(folders, folder)
	}

	return folders, nil
}

// UpdateImportFolder updates an existing import folder.
func (r *Repository) UpdateImportFolder(ctx context.Context, id string, updates map[string]interface{}) error {
	setParts := []string{}
	args := []interface{}{}

	for field, value := range updates {
		switch field {
		case "name", "path", "enabled":
			setParts = append(setParts, field+" = ?")
			args = append(args, value)
		}
	}

	if len(setParts) == 0 {
		return nil
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE import_folders SET %s WHERE id = ?", strings.Join(setParts, ", "))

	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// DeleteImportFolder removes an import folder configuration.
func (r *Repository) DeleteImportFolder(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM import_folders WHERE id = ?`, id)
	return err
}

// GetImportSettings retrieves the global import settings.
func (r *Repository) GetImportSettings(ctx context.Context) (*models.ImportSettings, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, destination_path, template, updated_at
		FROM import_settings
		WHERE id = 'default'
	`)

	var settings models.ImportSettings
	var updatedAt string

	if err := row.Scan(&settings.ID, &settings.DestinationPath, &settings.Template, &updatedAt); err != nil {
		return nil, err
	}

	settings.UpdatedAt = parseTime(updatedAt)
	return &settings, nil
}

// UpdateImportSettings updates the global import settings.
func (r *Repository) UpdateImportSettings(ctx context.Context, settings *models.ImportSettings) error {
	settings.UpdatedAt = time.Now().UTC()

	_, err := r.db.ExecContext(ctx, `
		UPDATE import_settings
		SET destination_path = ?, template = ?, updated_at = ?
		WHERE id = 'default'
	`, settings.DestinationPath, settings.Template, settings.UpdatedAt.Format(time.RFC3339))

	return err
}

// GetLibraryPathsWithBookCounts retrieves library paths with their book counts.
func (r *Repository) GetLibraryPathsWithBookCounts(ctx context.Context) ([]models.LibraryPath, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT lp.id, lp.path, lp.name, lp.enabled, lp.created_at, lp.last_scanned_at,
		       COUNT(a.id) as book_count
		FROM library_paths lp
		LEFT JOIN audiobooks a ON a.library_path_id = lp.id
		WHERE lp.enabled = 1
		GROUP BY lp.id
		ORDER BY lp.created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []models.LibraryPath
	for rows.Next() {
		var path models.LibraryPath
		var createdAt string
		var lastScannedAt sql.NullString

		if err := rows.Scan(
			&path.ID, &path.Path, &path.Name, &path.Enabled, &createdAt, &lastScannedAt, &path.BookCount,
		); err != nil {
			return nil, err
		}

		path.CreatedAt = parseTime(createdAt)
		if lastScannedAt.Valid {
			scanned := parseTime(lastScannedAt.String)
			path.LastScannedAt = &scanned
		}

		paths = append(paths, path)
	}

	mapping, err := r.loadPathLibraries(ctx)
	if err != nil {
		return nil, err
	}

	for i := range paths {
		if libs, ok := mapping[paths[i].ID]; ok {
			paths[i].Libraries = libs
		}
	}

	return paths, nil
}

// UpdateLibraryPath updates an existing library path.
func (r *Repository) UpdateLibraryPath(ctx context.Context, id string, updates map[string]interface{}) error {
	setParts := []string{}
	args := []interface{}{}

	for field, value := range updates {
		switch field {
		case "name", "path", "enabled":
			setParts = append(setParts, field+" = ?")
			args = append(args, value)
		case "last_scanned_at":
			setParts = append(setParts, field+" = ?")
			if value != nil {
				args = append(args, value.(time.Time).Format(time.RFC3339))
			} else {
				args = append(args, nil)
			}
		}
	}

	if len(setParts) == 0 {
		return nil
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE library_paths SET %s WHERE id = ?", strings.Join(setParts, ", "))

	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// DeleteLibraryPath removes a library path configuration.
func (r *Repository) DeleteLibraryPath(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM library_paths WHERE id = ?`, id)
	return err
}

// GetEnabledLibraryPaths returns only enabled library paths.
func (r *Repository) GetEnabledLibraryPaths(ctx context.Context) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT path FROM library_paths WHERE enabled = 1 ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, err
		}
		paths = append(paths, path)
	}

	return paths, nil
}

// GetContinueListening returns audiobooks the user is currently listening to, sorted by last played.
func (r *Repository) GetContinueListening(ctx context.Context, userID string, libraryID *string, limit int) ([]models.Audiobook, error) {
	query := `
		SELECT a.id, a.library_id, a.metadata_id, a.asset_path, a.library_path_id, a.created_at, a.updated_at,
		       m.id, m.title, m.subtitle, m.author, m.narrator, m.description,
		       m.cover_url, m.series_info, m.release_date,
		       u.progress_sec, u.is_favorite, u.last_played_at,
		       COALESCE(mf_stats.file_count, 0) as file_count,
		       COALESCE(mf_stats.total_duration, 0) as total_duration_sec
		FROM user_audiobook_data u
		JOIN audiobooks a ON a.id = u.audiobook_id
		LEFT JOIN book_metadata m ON m.id = a.metadata_id
		LEFT JOIN (
			SELECT audiobook_id,
			       COUNT(*) as file_count,
			       SUM(duration_sec) as total_duration
			FROM media_files
			GROUP BY audiobook_id
		) mf_stats ON mf_stats.audiobook_id = a.id
		WHERE u.user_id = ? AND u.progress_sec > 0 AND u.last_played_at IS NOT NULL
	`

	queryArgs := []interface{}{userID}
	if libraryID != nil && *libraryID != "" {
		query += " AND a.library_id = ?"
		queryArgs = append(queryArgs, *libraryID)
	}

	query += "\nORDER BY u.last_played_at DESC\nLIMIT ?"
	queryArgs = append(queryArgs, limit)

	rows, err := r.db.QueryContext(ctx, query, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var audiobooks []models.Audiobook
	for rows.Next() {
		var ab models.Audiobook
		var createdAt, updatedAt string
		var metaRow models.BookMetadata
		var subtitle, narrator, description, coverURL, seriesInfo, releaseDate sql.NullString
		var metadataID sql.NullString
		var libraryID sql.NullString
		var progress sql.NullFloat64
		var favorite sql.NullInt64
		var lastPlayedAt sql.NullString
		var fileCount int
		var totalDuration float64

		if err := rows.Scan(
			&ab.ID, &libraryID, &metadataID, &ab.AssetPath, &ab.LibraryPathID, &createdAt, &updatedAt,
			&metaRow.ID, &metaRow.Title, &subtitle, &metaRow.Author, &narrator, &description,
			&coverURL, &seriesInfo, &releaseDate,
			&progress, &favorite, &lastPlayedAt,
			&fileCount, &totalDuration,
		); err != nil {
			return nil, err
		}

		ab.LibraryID = nullableString(libraryID)
		ab.MetadataID = nullableString(metadataID)
		ab.CreatedAt = parseTime(createdAt)
		ab.UpdatedAt = parseTime(updatedAt)
		ab.FileCount = fileCount
		ab.TotalDurationSec = totalDuration

		if metaRow.ID != "" {
			meta := metaRow
			meta.Subtitle = nullableString(subtitle)
			meta.Narrator = nullableString(narrator)
			meta.Description = nullableString(description)
			meta.CoverURL = nullableString(coverURL)
			meta.SeriesInfo = nullableString(seriesInfo)
			meta.ReleaseDate = nullableString(releaseDate)
			if strings.TrimSpace(meta.Title) != "" {
				ab.Metadata = &meta
			}
		}

		// User data
		ud := models.UserAudiobookData{
			UserID:      userID,
			AudiobookID: ab.ID,
			ProgressSec: progress.Float64,
			IsFavorite:  favorite.Int64 == 1,
		}
		if lastPlayedAt.Valid && lastPlayedAt.String != "" {
			t := parseTime(lastPlayedAt.String)
			ud.LastPlayedAt = &t
		}
		ab.UserData = &ud

		audiobooks = append(audiobooks, ab)
	}

	return audiobooks, rows.Err()
}

// GetUserFavorites returns audiobooks the user has marked as favorite.
func (r *Repository) GetUserFavorites(ctx context.Context, userID string, libraryID *string, offset, limit int) ([]models.Audiobook, int, error) {
	// First get total count
	countQuery := `
		SELECT COUNT(*) FROM user_audiobook_data u
		JOIN audiobooks a ON a.id = u.audiobook_id
		WHERE u.user_id = ? AND u.is_favorite = 1
	`
	countArgs := []interface{}{userID}
	if libraryID != nil && *libraryID != "" {
		countQuery += " AND a.library_id = ?"
		countArgs = append(countArgs, *libraryID)
	}

	var total int
	err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Then get the audiobooks
	query := `
		SELECT a.id, a.library_id, a.metadata_id, a.asset_path, a.library_path_id, a.created_at, a.updated_at,
		       m.id, m.title, m.subtitle, m.author, m.narrator, m.description,
		       m.cover_url, m.series_info, m.release_date,
		       u.progress_sec, u.is_favorite, u.last_played_at,
		       COALESCE(mf_stats.file_count, 0) as file_count,
		       COALESCE(mf_stats.total_duration, 0) as total_duration_sec
		FROM user_audiobook_data u
		JOIN audiobooks a ON a.id = u.audiobook_id
		LEFT JOIN book_metadata m ON m.id = a.metadata_id
		LEFT JOIN (
			SELECT audiobook_id,
			       COUNT(*) as file_count,
			       SUM(duration_sec) as total_duration
			FROM media_files
			GROUP BY audiobook_id
		) mf_stats ON mf_stats.audiobook_id = a.id
		WHERE u.user_id = ? AND u.is_favorite = 1
	`
	queryArgs := []interface{}{userID}
	if libraryID != nil && *libraryID != "" {
		query += " AND a.library_id = ?"
		queryArgs = append(queryArgs, *libraryID)
	}

	query += `
		ORDER BY a.created_at DESC
		LIMIT ? OFFSET ?
	`
	queryArgs = append(queryArgs, limit, offset)

	rows, err := r.db.QueryContext(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var audiobooks []models.Audiobook
	for rows.Next() {
		var ab models.Audiobook
		var createdAt, updatedAt string
		var metaRow models.BookMetadata
		var subtitle, narrator, description, coverURL, seriesInfo, releaseDate sql.NullString
		var metadataID sql.NullString
		var libraryID sql.NullString
		var progress sql.NullFloat64
		var favorite sql.NullInt64
		var lastPlayedAt sql.NullString
		var fileCount int
		var totalDuration float64

		if err := rows.Scan(
			&ab.ID, &libraryID, &metadataID, &ab.AssetPath, &ab.LibraryPathID, &createdAt, &updatedAt,
			&metaRow.ID, &metaRow.Title, &subtitle, &metaRow.Author, &narrator, &description,
			&coverURL, &seriesInfo, &releaseDate,
			&progress, &favorite, &lastPlayedAt,
			&fileCount, &totalDuration,
		); err != nil {
			return nil, 0, err
		}

		ab.LibraryID = nullableString(libraryID)
		ab.MetadataID = nullableString(metadataID)
		ab.CreatedAt = parseTime(createdAt)
		ab.UpdatedAt = parseTime(updatedAt)
		ab.FileCount = fileCount
		ab.TotalDurationSec = totalDuration

		if metaRow.ID != "" {
			meta := metaRow
			meta.Subtitle = nullableString(subtitle)
			meta.Narrator = nullableString(narrator)
			meta.Description = nullableString(description)
			meta.CoverURL = nullableString(coverURL)
			meta.SeriesInfo = nullableString(seriesInfo)
			meta.ReleaseDate = nullableString(releaseDate)
			if strings.TrimSpace(meta.Title) != "" {
				ab.Metadata = &meta
			}
		}

		// User data
		ud := models.UserAudiobookData{
			UserID:      userID,
			AudiobookID: ab.ID,
			ProgressSec: progress.Float64,
			IsFavorite:  favorite.Int64 == 1,
		}
		if lastPlayedAt.Valid && lastPlayedAt.String != "" {
			t := parseTime(lastPlayedAt.String)
			ud.LastPlayedAt = &t
		}
		ab.UserData = &ud

		audiobooks = append(audiobooks, ab)
	}

	return audiobooks, total, rows.Err()
}

