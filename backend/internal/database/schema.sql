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

CREATE TABLE IF NOT EXISTS book_metadata (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NULL,
    author TEXT NOT NULL,
    narrator TEXT NULL,
    description TEXT NULL,
    cover_url TEXT NULL,
    series_info TEXT NULL,
    release_date TEXT NULL
);

CREATE TABLE IF NOT EXISTS audiobooks (
    id TEXT PRIMARY KEY,
    library_id TEXT NULL,
    library_path_id TEXT NOT NULL,
    metadata_id TEXT NULL,
    asset_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE,
    FOREIGN KEY (library_path_id) REFERENCES library_paths(id) ON DELETE CASCADE,
    FOREIGN KEY (metadata_id) REFERENCES book_metadata(id) ON DELETE SET NULL
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

CREATE TABLE IF NOT EXISTS user_library (
    user_id TEXT NOT NULL,
    audiobook_id TEXT NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY (user_id, audiobook_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_library_user ON user_library(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_audiobook ON user_library(audiobook_id);

CREATE TABLE IF NOT EXISTS user_library_access (
    user_id TEXT NOT NULL,
    library_id TEXT NOT NULL,
    can_read INTEGER NOT NULL DEFAULT 1,
    can_write INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, library_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_library_access_user ON user_library_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_access_library ON user_library_access(library_id);

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
VALUES ('default', 'data/library', '{author}/{title}', datetime('now'));
