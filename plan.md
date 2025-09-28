# Core Concepts & Philosophy 📚

The system revolves around a two-tier library model with **runtime-configurable content management** supporting two distinct workflows:

## Content Management Philosophy

**Libraries vs Import Folders** - The system distinguishes between organized audiobook collections and staging areas:

- **📁 Libraries** - Well-organized audiobook directories that are scanned in-place. Files never move from their current locations. Perfect for existing organized collections.
- **📦 Import Folders** - Staging areas (downloads, temporary locations) where content is manually selected and copied to organized library structure using templates.

## Six Key Entities

- **User** – Account with authentication credentials and admin privileges flag. Admins manage the global catalog; regular users build personal libraries.
- **Audiobook** – Managed container for one or more media files in the global catalog. Tracks storage location and source type ("library" or "import"). Initially has no descriptive metadata.
- **MediaFile** – Individual audio asset (e.g., `.mp3`, `.m4b`). Always belongs to exactly one audiobook. Files are ordered using natural sort on filenames.
- **BookMetadata** – Descriptive data (title, author, cover, etc.) sourced from external providers. Audiobooks can link or unlink from metadata entries.
- **UserLibrary** – Many-to-many relationship between users and audiobooks. Users add books from the global catalog to their personal library.
- **UserAudiobookData** – Per-user playback data (progress, favorites, last played) for books in their personal library.
- **LibraryPath** – Runtime-configurable library directories that are scanned in-place for audiobooks.

This separation enables flexible multi-user management: admins curate a global catalog, users build personal libraries from available books, metadata can be swapped, and each user tracks independent progress.

# Database Schema (SQLite)

All primary keys are UUID strings for straightforward client integration.

## audiobooks

| Column       | Type | Constraints                               | Description                                      |
|--------------|------|-------------------------------------------|--------------------------------------------------|
| id           | TEXT | PRIMARY KEY                               | Audiobook identifier.                            |
| metadata_id  | TEXT | NULLABLE, FK (`book_metadata.id`)         | Linked metadata entry.                           |
| asset_path   | TEXT | NOT NULL                                  | Absolute base directory for the audiobook's media. |
| source       | TEXT | NOT NULL, DEFAULT 'library'               | Source type: 'library' or 'import'.             |
| created_at   | TEXT | NOT NULL                                  | ISO-8601 creation timestamp.                     |
| updated_at   | TEXT | NOT NULL                                  | ISO-8601 last update timestamp.                  |

## library_paths

| Column           | Type | Constraints                           | Description                                      |
|------------------|------|---------------------------------------|--------------------------------------------------|
| id               | TEXT | PRIMARY KEY                           | Library path identifier.                        |
| path             | TEXT | UNIQUE, NOT NULL                      | Absolute directory path to scan.                |
| name             | TEXT | NOT NULL                              | Display name for the library.                   |
| enabled          | INT  | NOT NULL, DEFAULT 1                   | Whether library is active for scanning.         |
| created_at       | TEXT | NOT NULL                              | ISO-8601 creation timestamp.                    |
| last_scanned_at  | TEXT | NULLABLE                              | ISO-8601 timestamp of last scan.                |

## media_files

| Column       | Type    | Constraints                               | Description                               |
|--------------|---------|-------------------------------------------|-------------------------------------------|
| id           | TEXT    | PRIMARY KEY                               | Media file identifier.                    |
| audiobook_id | TEXT    | NOT NULL, FK (`audiobooks.id`)            | Owning audiobook.                         |
| filename     | TEXT    | NOT NULL                                  | Relative path to the media file under `asset_path`. |
| duration_sec | REAL    | NOT NULL                                  | Duration in seconds.                      |
| mime_type    | TEXT    | NOT NULL                                  | MIME type for streaming.                  |

## book_metadata

| Column       | Type | Constraints | Description                              |
|--------------|------|-------------|------------------------------------------|
| id           | TEXT | PRIMARY KEY | External metadata identifier (e.g., ASIN) |
| title        | TEXT | NOT NULL    | Book title.                              |
| subtitle     | TEXT | NULLABLE    | Optional subtitle.                       |
| author       | TEXT | NOT NULL    | Author name.                             |
| narrator     | TEXT | NULLABLE    | Narrator name.                           |
| description  | TEXT | NULLABLE    | Summary/description.                     |
| cover_url    | TEXT | NULLABLE    | Artwork URL.                             |
| series_info  | TEXT | NULLABLE    | Series name and number.                  |
| release_date | TEXT | NULLABLE    | Original release date.                   |

## user_audiobook_data

| Column        | Type | Constraints                                   | Description                                  |
|---------------|------|-----------------------------------------------|----------------------------------------------|
| user_id       | TEXT | NOT NULL                                      | User identifier.                              |
| audiobook_id  | TEXT | NOT NULL, FK (`audiobooks.id`)                | Tracked audiobook.                           |
| progress_sec  | REAL | NOT NULL, DEFAULT 0                           | Current playback position.                   |
| is_favorite   | INT  | NOT NULL, DEFAULT 0                           | Favorite flag (0/1).                          |
| last_played_at| TEXT | NULLABLE                                       | ISO-8601 timestamp of last playback.         |
| PRIMARY KEY   |      | (`user_id`, `audiobook_id`)                   | Ensures one row per user/book combination.   |

## users

| Column        | Type | Constraints       | Description                                  |
|---------------|------|-------------------|----------------------------------------------|
| id            | TEXT | PRIMARY KEY       | User identifier.                             |
| username      | TEXT | UNIQUE, NOT NULL  | Unique username for login.                   |
| password_hash | TEXT | NOT NULL          | Bcrypt-hashed password.                      |
| is_admin      | INT  | NOT NULL, DEFAULT 0 | Admin privileges (0/1).                    |
| api_key       | TEXT | UNIQUE, NULLABLE  | Optional API key for authentication.        |
| created_at    | TEXT | NOT NULL          | ISO-8601 creation timestamp.                |

## user_library

| Column       | Type | Constraints                                   | Description                                  |
|--------------|------|-----------------------------------------------|----------------------------------------------|
| user_id      | TEXT | NOT NULL, FK (`users.id`)                     | User who added the audiobook.                |
| audiobook_id | TEXT | NOT NULL, FK (`audiobooks.id`)                | Audiobook in user's personal library.       |
| added_at     | TEXT | NOT NULL                                      | ISO-8601 timestamp when added to library.   |
| PRIMARY KEY  |      | (`user_id`, `audiobook_id`)                   | Ensures one row per user/book combination.   |

# Content Management Workflows 🔄

## Library Scanning (In-Place)

**Use Case**: Well-organized audiobook collections that should stay where they are.

1. **Configure Library Paths** - Admins add library directories via admin UI
2. **Scan Libraries** - System discovers audiobooks in configured paths
3. **Catalog Creation** - Audiobooks added to global catalog with `source = 'library'`
4. **Files Stay Put** - No copying or moving, files streamed from original locations

**Example Directory Structure**:
```
/media/audiobooks/
├── Fiction/
│   ├── Andy Weir/
│   │   └── Project Hail Mary/
│   │       └── project_hail_mary.m4b
│   └── Douglas Adams/
│       └── Hitchhiker's Guide/
│           ├── 01_chapter.mp3
│           └── 02_chapter.mp3
└── Non-Fiction/
    └── Science/
        └── Cosmos/
            └── cosmos.m4b
```

## Import Process (Copy & Organize)

**Use Case**: Messy download folders, temporary locations, or content that needs organization.

1. **Configure Import Folders** - Set staging directories via environment variables
2. **Browse & Select** - Admins browse import folders and select specific files/directories
3. **Template Application** - Selected content copied using organization templates
4. **Catalog Creation** - Organized audiobooks added to catalog with `source = 'import'`

**Organization Templates**:
- `{author}/{title}` → `Andy Weir/Project Hail Mary/`
- `{author}/{series}/{title}` → `Douglas Adams/Hitchhiker's Guide/Restaurant at the End of Universe/`
- `flat` → All files in single directory
- Custom templates with tokens: `{narrator}`, `{year}`, `{series_num}`

**Example Import Flow**:
```
Import Folder: /downloads/messy/
├── project_hail_mary_andy_weir.m4b
├── some_random_file.txt
└── hitchhikers_guide_complete/
    ├── disc1.mp3
    └── disc2.mp3

↓ (Select audiobook files, apply template)

Library: /media/organized/
├── Andy Weir/
│   └── Project Hail Mary/
│       └── project_hail_mary_andy_weir.m4b
└── Douglas Adams/
    └── Hitchhiker's Guide to the Galaxy/
        ├── disc1.mp3
        └── disc2.mp3
```

# Configuration 🔧

## Environment Variables

| Variable           | Default               | Description                                    |
|--------------------|-----------------------|------------------------------------------------|
| SERVER_ADDR        | `:8080`              | HTTP server bind address and port              |
| DATABASE_PATH      | `data/flix_audio.db` | SQLite database file path                      |
| IMPORT_FOLDERS     | (empty)              | Comma-separated staging directories for imports |
| IMPORT_DESTINATION | `data/library`       | Target directory for organized imported content |
| IMPORT_TEMPLATE    | `{author}/{title}`   | Default organization template for imports      |
| ADMIN_USERNAME     | `admin`              | Initial admin user username                    |
| ADMIN_PASSWORD     | `admin`              | Initial admin user password                    |

## Runtime Configuration

**Library Paths** are configured at runtime through the admin UI:
- Add/remove library directories
- Enable/disable scanning for specific paths
- Track last scanned timestamps
- View book counts per library

**Import Folders** are configured via environment variables since they're system-level staging areas.

# API Endpoints

## Authentication

- `POST /api/v1/auth/login` – Authenticate user and receive API key
- `POST /api/v1/auth/logout` – End user session

## Global Catalog (All authenticated users)

- `GET /api/v1/catalog` – List all audiobooks with source tracking
- `GET /api/v1/catalog/{audiobook_id}` – Get details of any audiobook
- `GET /api/v1/catalog/search?q={query}` – Search the global catalog

**Catalog Response includes source tracking**:
```json
{
  "data": [
    {
      "id": "7e43a9b1-5e7c-4a1d-8422-9c3f56b7c5e8",
      "source": "library",
      "asset_path": "/media/audiobooks/Fiction/Andy Weir/Project Hail Mary",
      "metadata": {
        "title": "Project Hail Mary",
        "author": "Andy Weir"
      },
      "in_library": false
    }
  ]
}
```

## Personal Library Management

- `GET /api/v1/library` – List audiobooks in user's personal library
- `GET /api/v1/library/{audiobook_id}` – Get audiobook details with media files
- `POST /api/v1/library/add` – Add audiobook from catalog to personal library
- `DELETE /api/v1/library/{audiobook_id}` – Remove from personal library
- `POST /api/v1/library/{audiobook_id}/progress` – Update playback progress
- `POST /api/v1/library/{audiobook_id}/favorite` – Toggle favorite status

## Admin: Library Management

- `GET /api/v1/admin/libraries` – List configured library paths with book counts
- `POST /api/v1/admin/libraries` – Add new library path
- `PATCH /api/v1/admin/libraries/{id}` – Update library path (name, enabled status)
- `DELETE /api/v1/admin/libraries/{id}` – Remove library path
- `POST /api/v1/admin/libraries/scan` – Scan all enabled libraries
- `POST /api/v1/admin/libraries/{library_path}/scan` – Scan specific library

**Library Management Request**:
```json
{
  "path": "/media/audiobooks/fiction",
  "name": "Fiction Collection"
}
```

**Library Response**:
```json
{
  "data": [
    {
      "id": "lib-uuid",
      "path": "/media/audiobooks/fiction",
      "name": "Fiction Collection",
      "enabled": true,
      "book_count": 45,
      "last_scanned_at": "2025-01-01T12:00:00Z"
    }
  ]
}
```

## Admin: Import Management

- `GET /api/v1/admin/import-folders` – List configured import folders
- `GET /api/v1/admin/import-folders/{folder_id}/browse?path={subpath}` – Browse folder contents
- `POST /api/v1/admin/imports` – Create import job with file selection and template
- `GET /api/v1/admin/imports` – List import job history
- `GET /api/v1/admin/imports/{job_id}` – Get import job status

**Import Job Request**:
```json
{
  "folder_id": "folder_0",
  "selections": ["project_hail_mary.m4b", "hitchhikers_complete/"],
  "custom_template": "{author}/{series}/{title}"
}
```

**Import Job Response**:
```json
{
  "id": "job-uuid",
  "status": "completed",
  "source_paths": ["project_hail_mary.m4b"],
  "imported_books": [
    {
      "id": "book-uuid",
      "source": "import",
      "asset_path": "/media/organized/Andy Weir/Project Hail Mary",
      "metadata": {"title": "Project Hail Mary"}
    }
  ],
  "errors": [],
  "started_at": "2025-01-01T12:00:00Z",
  "completed_at": "2025-01-01T12:01:30Z"
}
```

## Admin: User & Content Management

- `GET /api/v1/admin/users` – List all users
- `POST /api/v1/admin/users` – Create new user
- `PATCH /api/v1/admin/users/{user_id}` – Update user (admin privileges, etc.)
- `DELETE /api/v1/admin/users/{user_id}` – Delete user
- `DELETE /api/v1/admin/audiobooks/{audiobook_id}` – Remove audiobook from catalog

## Metadata & Linking

- `GET /api/v1/metadata/search?q={query}` – Search external metadata providers
- `PUT /api/v1/admin/audiobooks/{audiobook_id}/link` – Link audiobook to metadata
- `DELETE /api/v1/admin/audiobooks/{audiobook_id}/link` – Remove metadata association

## Media Streaming

- `GET /api/v1/media_files/{file_id}` – Stream audio file with authorization checks
  - Users: Can only stream files from audiobooks in their personal library
  - Admins: Can stream any file
  - Supports HTTP range requests for seeking
  - Includes caching headers and ETags

# How It Works 🎯

## Admin Workflow

1. **Configure Libraries** - Add organized audiobook directories via admin UI
2. **Configure Import Folders** - Set staging directories via environment variables
3. **Scan Libraries** - Discover audiobooks in organized collections (files stay put)
4. **Import Content** - Browse staging folders, select content, organize with templates
5. **Manage Metadata** - Link audiobooks to external metadata sources
6. **Monitor System** - View library statistics, import job history

## User Workflow

1. **Browse Catalog** - Explore all available audiobooks (from both libraries and imports)
2. **Build Personal Library** - Add interesting audiobooks to personal collection
3. **Stream & Track Progress** - Listen to audiobooks with automatic progress tracking
4. **Manage Favorites** - Mark favorite audiobooks for easy access

## Source Tracking Benefits

- **Maintenance**: Know which audiobooks came from organized libraries vs imports
- **Cleanup**: Identify content that was imported and organized vs pre-existing
- **Analytics**: Track usage patterns between library vs imported content
- **Migration**: Handle library restructuring with source awareness

# Implementation Status ✅

## Completed Features

### ✅ Runtime Library Configuration
- Database-stored library paths with admin UI management
- Enable/disable libraries independently
- Track scan timestamps and book counts
- Migration from static environment configuration

### ✅ Dual Content Management
- Library scanning (in-place, no file movement)
- Import process with template-based organization
- Source tracking ("library" vs "import" in database)
- Template system with metadata token replacement

### ✅ Complete API Coverage
- Library management endpoints (CRUD operations)
- Import folder browsing and job creation
- Import job tracking with success/error reporting
- Backward compatibility with existing endpoints

### ✅ Admin UI Integration
- Tabbed interface for Libraries vs Import Folders
- Real-time library scanning with progress display
- Import folder browser with file selection
- Template configuration for custom organization

### ✅ Core System Features
- User authentication and authorization
- Personal library management
- Progress tracking and favorites
- Metadata linking system
- Secure media streaming

## Architecture Benefits

**Flexibility**: Support both organized collections and messy staging areas
**Control**: Manual selection prevents unwanted content import
**Organization**: Template system creates consistent library structure
**Scalability**: Runtime configuration supports growing collections
**Multi-tenancy**: Per-user libraries with admin-managed global catalog

The system provides the best of both worlds - automatic management for organized content and manual control for staging areas, with full source tracking and flexible organization options.