package library

import (
	"os"
	"path/filepath"
)

// Entry describes a candidate audiobook source in the library directory.
type Entry struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	Type      string `json:"type"`
	FileCount *int   `json:"file_count,omitempty"`
	SizeBytes *int64 `json:"size_bytes,omitempty"`
}

// Scanner lists the available sources under the configured library directory.
type Scanner struct {
	root string
}

// NewScanner creates a new Scanner.
func NewScanner(root string) *Scanner {
	return &Scanner{root: root}
}

// Root returns the scanner's base directory.
func (s *Scanner) Root() string {
	return s.root
}

// Scan returns the top-level entries in the library directory.
func (s *Scanner) Scan() ([]Entry, error) {
	entries := []Entry{}
	dirEntries, err := os.ReadDir(s.root)
	if err != nil {
		if os.IsNotExist(err) {
			return entries, nil
		}
		return nil, err
	}

	for _, de := range dirEntries {
		fullPath := filepath.Join(s.root, de.Name())

		relPath, err := filepath.Rel(s.root, fullPath)
		if err != nil {
			return nil, err
		}
		relPath = filepath.ToSlash(relPath)

		if de.IsDir() {
			count := countFiles(fullPath)
			entries = append(entries, Entry{
				Name:      de.Name(),
				Path:      relPath,
				Type:      "directory",
				FileCount: &count,
			})
			continue
		}

		info, err := de.Info()
		if err != nil {
			return nil, err
		}
		size := info.Size()
		entries = append(entries, Entry{
			Name:      de.Name(),
			Path:      relPath,
			Type:      "file",
			SizeBytes: &size,
		})
	}

	return entries, nil
}

func countFiles(dir string) int {
	var count int
	filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			return nil
		}
		count++
		return nil
	})
	return count
}
