# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lore is a full-stack audiobook management and streaming application with a Go backend and Next.js frontend. The application supports multi-library management, user authentication, audiobook metadata, and audio streaming with progress tracking.

## Architecture

### Backend (Go)
- **Framework**: Chi router with SQLite database
- **Structure**: Clean architecture with services, repositories, and handlers
  - `internal/app`: Application bootstrapping and initialization
  - `internal/auth`: Authentication service (API key based)
  - `internal/repository`: Database layer using raw SQL
  - `internal/services`: Business logic (audiobooks, library, import)
  - `internal/server`: HTTP handlers and middleware
  - `internal/models`: Domain models shared across layers
  - `cmd/server`: Main application entry point
  - `cmd/seed`: Development seed data generator

### Frontend (Next.js)
- **Framework**: Next.js 14 with App Router, React 18, TypeScript
- **State Management**:
  - TanStack Query for server state
  - Zustand for client state (audio player)
  - React Context for library selection
- **UI**: Radix UI primitives with Tailwind CSS
- **Audio**: Howler.js for media playback
- **Structure**:
  - `src/app/(dashboard)`: Main application routes with shared layout
  - `src/components`: Reusable UI components
  - `src/lib/api`: API client, types, and React Query hooks
  - `src/providers`: Context providers (library, app)

### Key Concepts
- **Libraries**: Named collections that can contain multiple directories
- **Library Paths**: Physical filesystem directories that can be shared across libraries
- **Audiobooks**: Discovered from library paths, can be linked to metadata
- **User Library**: Personal audiobook collection with progress tracking
- **Import System**: Staged imports from configured folders with template-based organization

## Development Commands

### Backend
```bash
cd backend

# Build the server
go build -o server ./cmd/server

# Run the server
./server

# Run tests
go test ./...

# Run tests with verbose output
go test -v ./...

# Run a specific test
go test -v ./internal/repository -run TestName

# Build and run the seed command (generates test data)
go build -o seed ./cmd/seed
./seed
```

### Frontend
```bash
cd web

# Install dependencies
npm install

# Development server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint
```

### Environment Variables

Backend (`.env` in `backend/`):
- `SERVER_ADDR`: Server address (default: `:8080`)
- `DATABASE_PATH`: SQLite database path (default: `data/lore.db`)
- `ADMIN_USERNAME`: Default admin username (default: `admin`)
- `ADMIN_PASSWORD`: Default admin password (default: `admin`)
- `LIBRARY_ROOT`: Root directory for browsing library paths (default: `.`)
- `IMPORT_ROOT`: Root directory for browsing import folders (default: `.`)

Frontend: The web client connects to `http://localhost:8080` by default (configured in `src/lib/constants/env.ts`).

## Code Style Notes

### Backend
- Use Chi router for HTTP routing
- Repository methods should use raw SQL queries (not an ORM)
- Services contain business logic and orchestrate repository calls
- Handlers validate input, call services, and format responses
- Error handling uses custom error types in `internal/errors`
- Authentication uses API keys stored in the `users` table
- Middleware: `AuthMiddleware` for authentication, `RequireAdmin` for admin-only routes

### Frontend
- Use TanStack Query hooks from `src/lib/api/hooks.ts` for data fetching
- API calls go through `apiFetch` in `src/lib/api/client.ts`
- Components use Radix UI primitives with `cn()` utility for styling
- Use `useLibraryContext()` to access selected library
- Audio player state managed via Zustand store

## Database Schema

The application uses SQLite with the following main tables:
- `libraries`: Named collections of audiobooks
- `library_paths`: Physical filesystem directories
- `library_directories`: Many-to-many join between libraries and paths
- `audiobooks`: Discovered audio content with optional metadata links
- `media_files`: Individual audio files within an audiobook
- `book_metadata`: Title, author, narrator, cover, etc.
- `users`: User accounts with password hashes and API keys
- `user_audiobook_data`: Per-user progress and favorites
- `user_library_access`: Per-user library permissions
- `import_folders`: Configured import staging directories
- `import_settings`: Global import configuration

Schema defined in: `backend/internal/database/schema.sql`

## API Structure

All API routes are under `/api/v1`:
- `/auth/*`: Login/logout
- `/libraries/*`: Public library browsing
- `/library/*`: Personal library with progress tracking
- `/users/me`: User profile management
- `/admin/*`: Admin-only endpoints (libraries, users, settings, import)
- `/media_files/{file_id}`: Audio streaming endpoint

See `backend/internal/server/server.go` for complete route definitions.