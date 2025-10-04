PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS libraries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'audiobook',
    description TEXT NULL,
    settings TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_libraries_type ON libraries(type);
CREATE INDEX IF NOT EXISTS idx_libraries_name ON libraries(name);

CREATE TABLE IF NOT EXISTS library_paths (
    id TEXT PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    last_scanned_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_library_paths_enabled ON library_paths(enabled);

CREATE TABLE IF NOT EXISTS library_directories (
    library_id TEXT NOT NULL,
    directory_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (library_id, directory_id),
    FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE,
    FOREIGN KEY (directory_id) REFERENCES library_paths(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_library_directories_library ON library_directories(library_id);
CREATE INDEX IF NOT EXISTS idx_library_directories_directory ON library_directories(directory_id);

-- Agent metadata from external providers (can be shared across audiobooks)
CREATE TABLE IF NOT EXISTS audiobook_metadata_agent (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NULL,
    author TEXT NOT NULL,
    narrator TEXT NULL,
    description TEXT NULL,
    cover_url TEXT NULL,
    series_info TEXT NULL,
    release_date TEXT NULL,
    isbn TEXT NULL,
    asin TEXT NULL,
    language TEXT NULL,
    publisher TEXT NULL,
    duration_sec REAL NULL,
    rating REAL NULL,
    rating_count INTEGER NULL,
    genres TEXT NULL,
    source TEXT NOT NULL DEFAULT 'unknown',
    external_id TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_metadata_source ON audiobook_metadata_agent(source, external_id);
CREATE INDEX IF NOT EXISTS idx_agent_metadata_title_author ON audiobook_metadata_agent(title, author);

CREATE TABLE IF NOT EXISTS audiobooks (
    id TEXT PRIMARY KEY,
    library_id TEXT NULL,
    library_path_id TEXT NOT NULL,
    metadata_id TEXT NULL,  -- Links to audiobook_metadata_agent (kept for backward compatibility)
    asset_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE,
    FOREIGN KEY (library_path_id) REFERENCES library_paths(id) ON DELETE CASCADE,
    FOREIGN KEY (metadata_id) REFERENCES audiobook_metadata_agent(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audiobooks_library ON audiobooks(library_id);
CREATE INDEX IF NOT EXISTS idx_audiobooks_metadata ON audiobooks(metadata_id);

CREATE TABLE IF NOT EXISTS media_files (
    id TEXT PRIMARY KEY,
    audiobook_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    duration_sec REAL NOT NULL,
    mime_type TEXT NOT NULL,
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_files_audiobook ON media_files(audiobook_id);

-- Embedded metadata extracted from file tags (1:1 with audiobook)
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

-- Manual metadata overrides with field-level locking (1:1 with audiobook)
CREATE TABLE IF NOT EXISTS audiobook_metadata_overrides (
    audiobook_id TEXT PRIMARY KEY,
    overrides TEXT NOT NULL,           -- JSON: {"field": {"value": "...", "locked": true}}
    updated_at TEXT NOT NULL,
    updated_by TEXT NULL,
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_metadata_overrides_user ON audiobook_metadata_overrides(updated_by);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    api_key TEXT UNIQUE NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);

CREATE TABLE IF NOT EXISTS user_audiobook_data (
    user_id TEXT NOT NULL,
    audiobook_id TEXT NOT NULL,
    progress_sec REAL NOT NULL DEFAULT 0,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    last_played_at TEXT NULL,
    PRIMARY KEY (user_id, audiobook_id),
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_audiobook_data_user ON user_audiobook_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_audiobook_data_audiobook ON user_audiobook_data(audiobook_id);

-- Removed user_library_access table - all users have access to all libraries

CREATE TABLE IF NOT EXISTS import_folders (
    id TEXT PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_import_folders_enabled ON import_folders(enabled);

CREATE TABLE IF NOT EXISTS import_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    destination_path TEXT NOT NULL,
    template TEXT NOT NULL DEFAULT '{author}/{title}',
    updated_at TEXT NOT NULL
);

-- Insert default settings if none exist
INSERT OR IGNORE INTO import_settings (id, destination_path, template, updated_at)
VALUES ('default', 'data/library', '{author}/{title}', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));

-- Insert default admin user with dev API key (password: "password")
INSERT OR IGNORE INTO users (id, username, password_hash, is_admin, api_key, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    1,
    '95b6c7945f0227edb9b39f2e62a914e4e17cd91c5fe6d7cd75cf24021d90d33f',
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
);
