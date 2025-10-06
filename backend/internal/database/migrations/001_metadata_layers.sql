-- Migration: Metadata Layers System
-- Implements layered metadata with agent, embedded, and override support
-- Includes field-level locking inspired by Plex

PRAGMA foreign_keys = OFF;

-- Step 1: Rename book_metadata to audiobook_metadata_agent
ALTER TABLE book_metadata RENAME TO audiobook_metadata_agent;

-- Step 2: Add new columns to agent metadata
ALTER TABLE audiobook_metadata_agent ADD COLUMN isbn TEXT NULL;
ALTER TABLE audiobook_metadata_agent ADD COLUMN asin TEXT NULL;
ALTER TABLE audiobook_metadata_agent ADD COLUMN language TEXT NULL;
ALTER TABLE audiobook_metadata_agent ADD COLUMN publisher TEXT NULL;
ALTER TABLE audiobook_metadata_agent ADD COLUMN duration_sec REAL NULL;
ALTER TABLE audiobook_metadata_agent ADD COLUMN rating REAL NULL;
ALTER TABLE audiobook_metadata_agent ADD COLUMN rating_count INTEGER NULL;
ALTER TABLE audiobook_metadata_agent ADD COLUMN genres TEXT NULL;
ALTER TABLE audiobook_metadata_agent ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE audiobook_metadata_agent ADD COLUMN external_id TEXT NULL;
ALTER TABLE audiobook_metadata_agent ADD COLUMN created_at TEXT NULL;
ALTER TABLE audiobook_metadata_agent ADD COLUMN updated_at TEXT NULL;

-- Update existing rows with current timestamp
UPDATE audiobook_metadata_agent
SET created_at = datetime('now'),
    updated_at = datetime('now')
WHERE created_at IS NULL;

-- Step 3: Add indexes to agent metadata
CREATE INDEX IF NOT EXISTS idx_agent_metadata_source ON audiobook_metadata_agent(source, external_id);
CREATE INDEX IF NOT EXISTS idx_agent_metadata_title_author ON audiobook_metadata_agent(title, author);

-- Step 4: Create embedded metadata table
CREATE TABLE IF NOT EXISTS audiobook_metadata_embedded (
    audiobook_id TEXT PRIMARY KEY,
    title TEXT NULL,
    subtitle TEXT NULL,
    author TEXT NULL,
    narrator TEXT NULL,
    album TEXT NULL,
    genre TEXT NULL,
    year TEXT NULL,
    track_number TEXT NULL,
    comment TEXT NULL,
    embedded_cover BLOB NULL,
    cover_mime_type TEXT NULL,
    extracted_at TEXT NOT NULL,
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE
);

-- Step 5: Create metadata overrides table
-- Presence of field in overrides = locked/frozen custom value
CREATE TABLE IF NOT EXISTS audiobook_metadata_overrides (
    audiobook_id TEXT PRIMARY KEY,
    overrides TEXT NOT NULL,           -- JSON: {"field": {"value": "..."}}
    updated_at TEXT NOT NULL,
    updated_by TEXT NULL,
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_metadata_overrides_user ON audiobook_metadata_overrides(updated_by);

PRAGMA foreign_keys = ON;
