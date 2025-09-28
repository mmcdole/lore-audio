# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

**Start the entire development environment:**
```bash
./run.sh
```
This starts both backend (port 8080) and frontend (port 3000) with proper configuration.

**First-time setup:**
```bash
cd web && npm install && cd ..
```

**Access points:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Default admin: username=`admin`, password=`admin`

## Architecture Overview

**Flix Audio** is a self-hosted audiobook server with Go backend and Next.js frontend.

### Backend (Go + SQLite)
- **Tech**: Go 1.21+, Chi router, SQLite database
- **Structure**: Clean architecture with services, handlers, and repository layers
- **Key services**: `audiobooks`, `library`, `import`, `auth`
- **Configuration**: Environment variables in `backend/.env`

### Frontend (Next.js 14)
- **Tech**: Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui
- **State**: TanStack Query for server state, Zustand for client state
- **Authentication**: Automatic dev token injection via middleware
- **Structure**: Domain-grouped routes (`app/(dashboard)/admin/`)

## Development Commands

### Backend
```bash
# Run manually
cd backend && go run ./cmd/server

# Run tests
cd backend && go test ./...

# Build binary
cd backend && go build -o server ./cmd/server
```

### Frontend
```bash
# Install dependencies
cd web && npm install

# Development server
cd web && npm run dev

# Build for production
cd web && npm run build

# Lint
cd web && npm run lint
```

## Path Handling Architecture

**Critical concept**: The system uses a Plex-style path architecture for security and portability.

- **Database storage**: Full absolute paths (e.g., `/Users/drake/Documents/audiobooks/fiction`)
- **API operations**: Relative paths from configured roots (e.g., `fiction`)
- **Frontend conversion**: Uses `/api/v1/admin/filesystem/roots` endpoint and `src/lib/path-utils.ts`

### Environment Configuration
Backend environment variables:
- `LIBRARY_ROOT`: Base directory for library browsing
- `IMPORT_ROOT`: Base directory for import staging
- `SERVER_ADDR`: Server bind address (default `:8080`)
- `DATABASE_PATH`: SQLite database file path

Frontend environment:
- `NEXT_PUBLIC_API_BASE_URL`: Backend API URL (default `http://localhost:8080`)

## Key API Patterns

### Authentication
- Development uses automatic admin token injection via middleware
- All `/api/*` requests get auto-authenticated in development
- Production authentication should be implemented differently

### Admin Routes Structure
- `/api/v1/admin/library-paths` - Library directory management
- `/api/v1/admin/import-folders` - Import directory management
- `/api/v1/admin/filesystem/{root}/browse` - Filesystem browsing (relative paths)
- `/api/v1/admin/filesystem/roots` - Get configured root paths

## Data Flow

1. **Library Management**: Admin configures library paths → Backend stores full paths → UI displays full paths
2. **Filesystem Browsing**: UI converts full paths to relative → API uses relative paths → Returns both relative and full paths
3. **Path Conversion**: `path-utils.ts` handles conversion between full and relative paths using cached root configuration

## Troubleshooting

**Port conflicts:**
```bash
killall server
pkill -f "npm run dev"
```

**Cache issues:**
```bash
rm -rf web/.next
```

**Environment setup:** Ensure `backend/.env` and `web/.env.local` exist with correct values.