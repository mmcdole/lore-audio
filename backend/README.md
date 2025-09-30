# Flix Audio Backend

Go-based audiobook management and streaming server with multi-library support, user authentication, and import workflows.

## Quick Start

```bash
# Build and run
go build -o server ./cmd/server
./server

# Run tests
go test ./...

# Generate seed data (development)
go build -o seed ./cmd/seed
./seed
```

Server runs on `:8080` by default. Configure via environment variables in `.env`.

## Architecture

**Clean architecture** with service layer orchestrating business logic and repository handling database access.

```
cmd/server/          # Application entry point
internal/
  app/               # Bootstrapping and DI
  auth/              # API key authentication
  config/            # Environment configuration
  database/          # SQLite setup and schema
  models/            # Domain models
  repository/        # Data access layer (raw SQL)
  services/          # Business logic
    audiobooks/      # Core audiobook operations
    library/         # Library and scanning
    import/          # Import workflows
  server/            # HTTP handlers and routing (Chi)
  validation/        # Request validation
```

## Key Concepts

- **Libraries**: Named collections (e.g., "Audiobooks", "Podcasts")
- **Library Paths**: Physical directories that can be shared across libraries
- **Library Directories**: Many-to-many join between libraries and paths
- **Audiobooks**: Discovered from library paths, optionally linked to metadata
- **Import System**: Copy/organize files from staging folders using templates

## Configuration

Environment variables (`.env`):

```bash
SERVER_ADDR=:8080                          # Listen address
DATABASE_PATH=data/flix_audio.db           # SQLite database
ADMIN_USERNAME=admin                       # Default admin
ADMIN_PASSWORD=admin                       # Default password
LIBRARY_ROOT=.                             # Browse root for library paths
IMPORT_ROOT=.                              # Browse root for import folders
```

## API Overview

All routes under `/api/v1`:

- **Auth**: `POST /auth/login`, `POST /auth/logout`
- **Libraries**: `GET /libraries` (public catalog)
- **Personal Library**: `GET /library`, `POST /library/{id}/progress`
- **Admin**: `/admin/*` (libraries, users, settings, import, scanning)
- **Streaming**: `GET /media_files/{file_id}`

## Database

SQLite with foreign key enforcement. Schema in `internal/database/schema.sql`.

**Core tables**: `libraries`, `library_paths`, `library_directories`, `audiobooks`, `media_files`, `book_metadata`, `users`, `user_audiobook_data`, `import_folders`, `import_settings`

## Development

**Testing**: Use `go test ./...` or `go test -v ./internal/repository -run TestName` for specific tests.

**Seeding**: Run `./seed` to populate test data (creates admin user, libraries, sample audiobooks).

**Audio Duration**: Requires `ffprobe` for extracting media file durations during import.

## Dependencies

- `github.com/go-chi/chi/v5` - HTTP router
- `github.com/mattn/go-sqlite3` - SQLite driver
- `github.com/google/uuid` - UUID generation
- `golang.org/x/crypto` - Password hashing