# Flix-Audio System Update Plan

## Overview
Transform the current system into a full-featured audiobook management platform inspired by AudiobookShelf, with proper file organization, metadata matching, and background task processing.

## 1. Navigation & Terminology Updates

### Updated Navigation Structure
Based on AudiobookShelf's UI:
- **Home** → User's personal bookshelf (favorites, in-progress, recently played)
- **Library** → Browse all available audiobooks (rename from "catalog")
- **Series** → Browse books by series
- **Collections** → User-created collections
- **Authors** → Browse by author and narrator

### API Endpoint Renaming
```
/api/v1/catalog → /api/v1/library
/api/v1/library → /api/v1/bookshelf (user's personal collection)
```

## 2. File Organization & Import System

### Library Folder Structure
Flix-Audio will maintain an organized library structure:

```
/audiobooks/                          # Main library directory
  /{Author Name}/                     # Author folder (sanitized)
    /{Book Title}/                    # Book folder (sanitized)
      /cover.jpg                      # Downloaded/extracted cover
      /metadata.json                  # Cached metadata from providers
      /Book Title.m4b                 # Single file (merged or original)
      -- OR --
      /Part 01 - Chapter Name.mp3     # Multi-file books
      /Part 02 - Chapter Name.mp3
      ...
```

### Folder Naming Conventions
- **Sanitization**: Remove invalid characters: `< > : " / \ | ? *`
- **Author Names**:
  - Multiple authors: "Author One & Author Two" or "Author One, Author Two"
  - Unknown author: "_Unknown Author"
- **Book Titles**:
  - Include series if present: "Series Name 01 - Book Title"
  - Truncate at 100 characters for filesystem limits
- **Special Cases**:
  - Various Artists: Use "_Various" as author folder
  - Compilations: Use primary editor/compiler as author

### Import Options
1. **In-Place Reference**: Keep files in source location, reference only
2. **Copy Import**: Copy files to organized library structure
3. **Move Import**: Move files to organized library structure
4. **Smart Import**: Copy if source is removable media, reference if local

## 3. Database Schema Extensions

### New Tables for Enhanced Features

```sql
-- Authors table (normalized from book_metadata)
CREATE TABLE authors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    name_normalized TEXT NOT NULL, -- lowercase, no accents
    description TEXT,
    image_url TEXT,
    asin TEXT,                     -- Author's Audible ID
    goodreads_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Series table
CREATE TABLE series (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_normalized TEXT NOT NULL,
    description TEXT,
    primary_author_id TEXT,
    total_books INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (primary_author_id) REFERENCES authors(id)
);

-- Many-to-many: Book-Author relationship
CREATE TABLE book_authors (
    id TEXT PRIMARY KEY,
    book_metadata_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_type TEXT NOT NULL, -- 'author' or 'narrator'
    order_index INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (book_metadata_id) REFERENCES book_metadata(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
    UNIQUE(book_metadata_id, author_id, author_type)
);

-- Book-Series relationship (book can be in multiple series)
CREATE TABLE book_series (
    id TEXT PRIMARY KEY,
    book_metadata_id TEXT NOT NULL,
    series_id TEXT NOT NULL,
    sequence TEXT, -- "1", "1.5", "1-3" for omnibus
    created_at TEXT NOT NULL,
    FOREIGN KEY (book_metadata_id) REFERENCES book_metadata(id) ON DELETE CASCADE,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
    UNIQUE(book_metadata_id, series_id)
);

-- Collections (user-created groups)
CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_public INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Collection-Audiobook junction
CREATE TABLE collection_audiobooks (
    collection_id TEXT NOT NULL,
    audiobook_id TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    added_at TEXT NOT NULL,
    PRIMARY KEY (collection_id, audiobook_id),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE
);

-- Background tasks table
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'import', 'merge_m4b', 'embed_metadata', 'download_cover'
    status TEXT NOT NULL, -- 'pending', 'running', 'completed', 'failed'
    title TEXT NOT NULL,
    description TEXT,
    user_id TEXT,
    data TEXT, -- JSON data for task specifics
    progress REAL DEFAULT 0, -- 0-100
    error_message TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

```

### Updates to Existing Tables

```sql
-- Extend audiobooks table
ALTER TABLE audiobooks ADD COLUMN local_cover_path TEXT;
ALTER TABLE audiobooks ADD COLUMN organized_path TEXT; -- final organized location
ALTER TABLE audiobooks ADD COLUMN import_status TEXT DEFAULT 'completed'; -- 'pending', 'processing', 'completed', 'failed'
ALTER TABLE audiobooks ADD COLUMN import_type TEXT; -- 'copy', 'move', 'reference'
ALTER TABLE audiobooks ADD COLUMN source_path TEXT; -- original import location
ALTER TABLE audiobooks ADD COLUMN task_id TEXT; -- reference to background task
ALTER TABLE audiobooks ADD COLUMN date_added TEXT;
ALTER TABLE audiobooks ADD COLUMN temporary_title TEXT; -- filename-based title for pending imports

-- Extend book_metadata to handle provider data
ALTER TABLE book_metadata ADD COLUMN asin TEXT;
ALTER TABLE book_metadata ADD COLUMN isbn10 TEXT;
ALTER TABLE book_metadata ADD COLUMN isbn13 TEXT;
ALTER TABLE book_metadata ADD COLUMN goodreads_id TEXT;
ALTER TABLE book_metadata ADD COLUMN provider TEXT; -- source of metadata
ALTER TABLE book_metadata ADD COLUMN provider_id TEXT; -- ID from provider
ALTER TABLE book_metadata ADD COLUMN language TEXT;
ALTER TABLE book_metadata ADD COLUMN publisher TEXT;
ALTER TABLE book_metadata ADD COLUMN genres TEXT; -- JSON array
ALTER TABLE book_metadata ADD COLUMN tags TEXT; -- JSON array
ALTER TABLE book_metadata ADD COLUMN duration_sec REAL;
ALTER TABLE book_metadata ADD COLUMN abridged INTEGER DEFAULT 0;
```

## 4. Multiple Authors Handling

AudiobookShelf uses a many-to-many relationship for authors, which we'll adopt:

### Author Management
- **Primary Authors**: Books can have multiple co-authors
- **Narrators**: Separate relationship type in `book_authors` table
- **Display Format**: "Author One & Author Two" or customizable separator
- **Author Merging**: Admin feature to merge duplicate authors
- **Author Aliases**: Support for pseudonyms and alternate names

### API Response Example
```json
{
  "id": "book-uuid",
  "metadata": {
    "title": "Good Omens",
    "authors": [
      {"id": "author1", "name": "Terry Pratchett", "type": "author"},
      {"id": "author2", "name": "Neil Gaiman", "type": "author"}
    ],
    "narrators": [
      {"id": "narrator1", "name": "Martin Jarvis", "type": "narrator"}
    ]
  }
}
```

## 5. Metadata Providers & Series Data

### Provider Sources (from AudiobookShelf research)
AudiobookShelf fetches metadata from:
1. **Audible** (primary source for audiobooks)
   - Provides: title, author, narrator, series (with sequence), description, cover, duration, genres, tags, ASIN
   - Regions: .com, .ca, .co.uk, .com.au, .fr, .de, .co.jp, .it, .in, .es
2. **Google Books**
   - Provides: title, author, description, cover, ISBN, genres, publisher
   - Note: Does NOT provide series information
3. **iTunes/Apple Books**
   - Provides: title, author, narrator, description, cover
4. **OpenLibrary**
   - Provides: title, author, description, cover, ISBN
5. **AudiobookCovers**
   - Specialized for high-quality cover art

### Series Data Extraction
- **Primary Source**: Audible API (via Audnexus proxy)
- **Series Types**: Primary series and secondary series
- **Sequence Handling**: Clean numbers from strings like "Book 1" → "1"
- **Multiple Series**: Books can belong to multiple series (e.g., standalone + universe)

## 6. Background Task System

### Task Manager Architecture
Based on AudiobookShelf's approach:

```javascript
// Task types
const TaskTypes = {
  IMPORT: 'import',
  MERGE_M4B: 'merge_m4b',
  EMBED_METADATA: 'embed_metadata',
  DOWNLOAD_COVER: 'download_cover',
  MATCH_METADATA: 'match_metadata',
  SCAN_LIBRARY: 'scan_library'
}

// Task lifecycle
1. Create task → Add to queue
2. Create placeholder entry (for imports)
3. Process task in background
4. Update progress via WebSocket/SSE
5. Complete/fail with final status
```

### Import Process with Placeholder Entries
1. **Immediate Response**:
   - Create audiobook entry directly with minimal data:
     - `id` (new UUID)
     - `source_path` (original location)
     - `import_status: 'pending'`
     - `import_type` ('copy', 'move', or 'reference')
     - `temporary_title` (extracted from filename)
     - `task_id` (reference to background task)
   - Create task in `tasks` table
   - Return audiobook ID to client immediately
   - Book appears in library with pending indicator

2. **Background Processing**:
   - Copy/move files based on import_type
   - Extract metadata from audio files
   - Auto-match with providers (if enabled)
   - Download cover art
   - Generate organized_path
   - Update the existing audiobook record with:
     - Full metadata
     - `asset_path` (final location)
     - `organized_path`
     - `import_status: 'completed'`
   - Create media_files entries
   - Remove `temporary_title` once real metadata is set

3. **Real-time Updates**:
   - WebSocket events for progress
   - Task status updates
   - UI can show different states:
     - Pending (with progress bar)
     - Processing (with cancel option)
     - Failed (with retry option)
     - Completed (full book details)

4. **Benefits of Single Table Approach**:
   - No data migration between tables
   - Simpler schema and queries
   - Books visible immediately in library
   - Can match metadata while still importing
   - Failed imports remain visible for retry

### M4B Conversion Task
- Use FFmpeg for merging
- Preserve/generate chapters at file boundaries
- Embed metadata and cover
- Progress monitoring via FFmpeg output parsing
- Option to replace original files or keep both

## 7. Matching System

### Matching Workflow
1. **During Import**:
   - Extract embedded metadata
   - Auto-search providers using title/author
   - Use Levenshtein distance for fuzzy matching
   - If confidence > threshold, auto-match
   - Otherwise, mark for manual review

2. **Manual Matching**:
   - Search multiple providers
   - Display results with match scores
   - Allow selection of best match
   - Option to edit before saving

3. **Re-matching**:
   - Change metadata source anytime
   - Keep provider IDs for easy updates
   - Bulk matching for multiple books

### Match Scoring Algorithm
```javascript
// Based on AudiobookShelf's approach
- Title similarity (Levenshtein distance)
- Author similarity
- Duration comparison (for audiobooks)
- ISBN/ASIN exact match (highest confidence)
- Narrator match (for audiobooks)
```

## 8. API Endpoints

### New Core Endpoints

```
# Authors & Narrators
GET    /api/v1/authors                 # List all authors
GET    /api/v1/authors/{id}            # Author details with books
GET    /api/v1/narrators               # List all narrators
POST   /api/v1/admin/authors/merge     # Merge duplicate authors

# Series Management
GET    /api/v1/series                  # List all series
GET    /api/v1/series/{id}             # Series details with books in order

# Collections
GET    /api/v1/collections             # User's collections
POST   /api/v1/collections             # Create collection
PUT    /api/v1/collections/{id}        # Update collection
DELETE /api/v1/collections/{id}        # Delete collection
POST   /api/v1/collections/{id}/items  # Add items to collection

# Import & File Management
POST   /api/v1/admin/import            # Import with options
GET    /api/v1/admin/import/scan       # Scan directory for importable items
POST   /api/v1/admin/organize          # Reorganize library files
GET    /api/v1/admin/folders/structure # Get current folder structure

# Metadata Matching
POST   /api/v1/metadata/search         # Search providers
GET    /api/v1/metadata/providers      # List available providers
POST   /api/v1/metadata/match          # Match book with metadata
POST   /api/v1/admin/metadata/batch    # Batch match multiple books

# Background Tasks
GET    /api/v1/tasks                   # List tasks (user's or all for admin)
GET    /api/v1/tasks/{id}              # Task details with progress
DELETE /api/v1/tasks/{id}              # Cancel task
GET    /api/v1/tasks/{id}/log          # Get task execution log

# M4B Tools
POST   /api/v1/admin/tools/merge-m4b   # Start M4B merge task
POST   /api/v1/admin/tools/embed       # Embed metadata/cover in files

# Home Dashboard
GET    /api/v1/home                    # Dashboard with continue listening, recent, etc.
```

### WebSocket Events
```javascript
// Real-time updates for:
- task_started
- task_progress
- task_completed
- task_failed
- import_started
- import_progress
- library_item_added
- library_item_updated
```

## 9. Implementation Phases

### Phase 1: Core Schema & Navigation (Week 1)
- [ ] Create new database tables
- [ ] Migrate existing data to new schema
- [ ] Rename endpoints (catalog → library)
- [ ] Implement Authors and Series models
- [ ] Add navigation structure

### Phase 2: File Organization (Week 1-2)
- [ ] Implement folder structure manager
- [ ] Create import queue system
- [ ] Add placeholder entry support
- [ ] Build file sanitization utilities
- [ ] Implement copy/move/reference imports

### Phase 3: Background Tasks (Week 2)
- [ ] Create task manager service
- [ ] Implement WebSocket notifications
- [ ] Add task queue processing
- [ ] Build progress tracking
- [ ] Add task cancellation

### Phase 4: Metadata System (Week 3)
- [ ] Implement provider interfaces
- [ ] Add Audible provider (via Audnexus)
- [ ] Add Google Books provider
- [ ] Build matching algorithm
- [ ] Create manual match UI

### Phase 5: M4B Conversion (Week 4)
- [ ] FFmpeg integration
- [ ] Chapter generation
- [ ] Metadata embedding
- [ ] Cover art embedding
- [ ] Batch processing

### Phase 6: Collections & Polish (Week 5)
- [ ] Collections CRUD operations
- [ ] Home dashboard
- [ ] Advanced search
- [ ] Bulk operations
- [ ] Performance optimization

## 10. Technical Decisions

### File Storage Strategy
- **Primary Library**: Single configurable root directory
- **Cache Directory**: For temporary files, conversions
- **Cover Storage**: Both filesystem and database options
- **Backup Strategy**: Metadata exports, no media backup

### Import Handling
- **Duplicate Detection**: By file hash or ISBN/ASIN
- **Conflict Resolution**: User choice or auto-resolve rules
- **Failed Imports**: Books remain in library with 'failed' status, can retry
- **Partial Imports**: Resume capability for large libraries
- **Placeholder Management**: Pending imports shown immediately in library

### Performance Considerations
- **Lazy Loading**: Pagination on all list endpoints
- **Image Optimization**: Multiple sizes, WebP support
- **Search Indexing**: Full-text search on metadata
- **Background Processing**: Worker threads for CPU-intensive tasks
- **Caching**: Provider responses, processed images

### Data Integrity
- **Orphan Cleanup**: Remove unused authors, series
- **Filesystem Sync**: Detect external changes
- **Metadata Backup**: Regular JSON exports
- **Transaction Safety**: Atomic operations for imports

## Summary

This plan transforms Flix-Audio into a comprehensive audiobook management system with:
- Organized file structure matching AudiobookShelf's approach
- Robust metadata matching from multiple providers
- Background task processing with real-time updates
- Support for multiple authors and series
- User collections and personalized home view
- M4B conversion and metadata embedding tools

The system maintains clean separation between the global library and user's personal bookshelf while providing powerful organization and management features.