# Flix Audio Backend

Go-based audiobook server with SQLite database and RESTful API.

## Tech Stack
- Go 1.21+
- SQLite database
- Chi router
- File-based library scanning

## Quick Start

### Environment Setup
The backend uses environment variables for configuration. Create a `.env` file in the backend directory:

```env
SERVER_ADDR=:8080
DATABASE_PATH=./data/flix_audio.db
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
LIBRARY_ROOT=/Users/drake/Documents/audiobooks
IMPORT_ROOT=/Users/drake/Documents/import
```

### Running the Server

From the project root:
```bash
./run.sh
```

Or manually:
```bash
cd backend
export $(cat .env | grep -v '^#' | xargs)
go run ./cmd/server
```

### Configuration Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_ADDR` | `:8080` | Server bind address and port |
| `DATABASE_PATH` | `./data/flix_audio.db` | SQLite database file path |
| `ADMIN_USERNAME` | `admin` | Default admin username |
| `ADMIN_PASSWORD` | `admin` | Default admin password |
| `LIBRARY_ROOT` | `.` | Root directory for library browsing |
| `IMPORT_ROOT` | `.` | Root directory for import staging |

## API Endpoints

### Public
- `POST /api/v1/auth/login` - Admin login

### Authenticated (Admin)
- `GET /api/v1/admin/library-paths` - List library directories
- `GET /api/v1/admin/import-folders` - List import directories
- `GET /api/v1/admin/import-settings` - Get import settings
- `GET /api/v1/admin/filesystem/{root}/browse` - Browse filesystem

## Development

```bash
# Install dependencies
go mod download

# Run tests
go test ./...

# Build binary
go build -o server ./cmd/server
```

## Database

The server uses SQLite with automatic migrations. The database file is created automatically at the configured path.