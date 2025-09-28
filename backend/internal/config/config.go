package config

import (
	"fmt"
	"os"
	"path/filepath"
)

// Config contains runtime configuration for the API server.
type Config struct {
	Address           string
	DatabasePath      string
	AdminUsername     string
	AdminPassword     string
	LibraryBrowseRoot string
	ImportBrowseRoot  string
}

// Load builds a Config from environment variables, applying sensible defaults.
func Load() Config {
	cfg := Config{
		Address:           getEnv("SERVER_ADDR", ":8080"),
		DatabasePath:      getEnv("DATABASE_PATH", filepath.Join("data", "flix_audio.db")),
		AdminUsername:     getEnv("ADMIN_USERNAME", "admin"),
		AdminPassword:     getEnv("ADMIN_PASSWORD", "admin"),
		LibraryBrowseRoot: getEnv("LIBRARY_ROOT", "."),
		ImportBrowseRoot:  getEnv("IMPORT_ROOT", "."),
	}

	// Ensure absolute paths
	cfg.DatabasePath = ensureAbsolute(cfg.DatabasePath)
	cfg.LibraryBrowseRoot = ensureAbsolute(cfg.LibraryBrowseRoot)
	cfg.ImportBrowseRoot = ensureAbsolute(cfg.ImportBrowseRoot)

	return cfg
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func ensureAbsolute(path string) string {
	if filepath.IsAbs(path) {
		return path
	}
	wd, err := os.Getwd()
	if err != nil {
		return path
	}
	return filepath.Join(wd, path)
}

// EnsureRuntimeDirs creates the directories needed for runtime assets.
func EnsureRuntimeDirs(cfg Config) error {
	dirsToCreate := []string{
		filepath.Dir(cfg.DatabasePath),
	}

	for _, dir := range dirsToCreate {
		if dir == "" {
			continue
		}
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create dir %s: %w", dir, err)
		}
	}
	return nil
}
