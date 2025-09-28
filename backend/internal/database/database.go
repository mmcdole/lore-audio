package database

import (
	"database/sql"
	"embed"
	"fmt"
	"os"
	"path/filepath"
)

import _ "github.com/mattn/go-sqlite3"

//go:embed schema.sql
var schemaFS embed.FS

// Open creates (if needed) and migrates the SQLite database at the provided path.
func Open(path string) (*sql.DB, error) {
	if err := ensureDir(path); err != nil {
		return nil, err
	}

	dsn := fmt.Sprintf("file:%s?_foreign_keys=on", path)
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}

	// Verify foreign keys are enabled
	var fkEnabled int
	if err := db.QueryRow("PRAGMA foreign_keys").Scan(&fkEnabled); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to check foreign key status: %w", err)
	}
	fmt.Printf("Foreign keys enabled: %d\n", fkEnabled)

	if err := applySchema(db); err != nil {
		db.Close()
		return nil, err
	}

	return db, nil
}

func ensureDir(path string) error {
	dir := filepath.Dir(path)
	if dir == "." || dir == "" {
		return nil
	}
	return os.MkdirAll(dir, 0o755)
}

func applySchema(db *sql.DB) error {
	if err := ensureColumn(db, "audiobooks", "library_id", "library_id TEXT NULL"); err != nil {
		return err
	}

	schema, err := schemaFS.ReadFile("schema.sql")
	if err != nil {
		return err
	}
	if _, err := db.Exec(string(schema)); err != nil {
		return err
	}
	return nil
}

func ensureColumn(db *sql.DB, table, column, definition string) error {
	var count int
	query := fmt.Sprintf("SELECT COUNT(*) FROM pragma_table_info('%s') WHERE name = ?", table)
	if err := db.QueryRow(query, column).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	alter := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s", table, definition)
	_, err := db.Exec(alter)
	return err
}
