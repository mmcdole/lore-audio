# Multi-Library Architecture

This document describes the current multi-library implementation for Flix Audio. It reflects the code as it exists now—no legacy catalog endpoints, no migrations, and no placeholder features that are not wired up.

---

## 1. Data Model

### 1.1 Tables

```sql
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

CREATE TABLE IF NOT EXISTS library_directories (
    library_id TEXT NOT NULL,
    directory_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (library_id, directory_id),
    FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE,
    FOREIGN KEY (directory_id) REFERENCES library_paths(id) ON DELETE CASCADE
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
```

Notes:
- `settings` remains in the schema for future per-library configuration, but the UI does not expose it and the code treats it as opaque.
- `audiobooks.library_id` is always populated when a title belongs to a library; the ingest pipeline now enforces this.

### 1.2 Go Models (`internal/models/models.go`)

Relevant structures:
- `models.Library` – name, display name, type, optional description/settings, computed `BookCount` and `Directories`.
- `models.LibrarySummary` – compact view used when attaching libraries to directory responses.
- `models.LibraryPath` – now includes `Libraries []LibrarySummary` to show which libraries reference a path.
- `models.Audiobook` – `LibraryID *string` (nil if the title is not tied to a library).
- `models.LibraryDirectory` / `models.UserLibraryAccess` – represent relationships and are ready for future access control work.

---

## 2. Repository Layer (`internal/repository/repository.go`)

Key capabilities:

| Category | Functions |
| --- | --- |
| Library lifecycle | `CreateLibrary`, `ListLibraries`, `GetLibraryByID`, `UpdateLibrary`, `DeleteLibrary` |
| Directory assignments | `SetLibraryDirectories` (replaces all directory links atomically), `ListLibraryDirectories` |
| Aggregates | `loadLibraryBookCounts`, `loadPathLibraries` keep computed fields up to date |
| Catalog queries | `ListCatalogAudiobooks` & `SearchCatalogAudiobooks` accept an optional `libraryID` pointer so callers can scope results; pagination metadata is returned alongside the slice |
| Personal collections | `ListUserLibraryAudiobooks` mirrors the catalog functions but joins through `user_library` |
| Helpers | JSON helpers for persisting library settings + `repository_helpers_test.go` to cover edge cases |

Whenever `SetLibraryDirectories` runs, it also updates `audiobooks.library_id` so existing rows stay consistent with the new assignment.

---

## 3. Services

### 3.1 Audiobook Service (`internal/services/audiobooks/service.go`)

- `ListLibraryBooks` / `SearchLibraryBooks` require a library ID and delegate to the repository catalog functions.
- `GetLibraryBook` fetches a single audiobook and ensures it belongs to the requested library.
- `ListUserLibrary` keeps the personal library functionality and still supports optional filtering by `library_id` query parameter.
- The import/admin creation paths resolve the owning library before calling `CreateAudiobook`, guaranteeing `library_id` is present.

### 3.2 Library Service (`internal/services/library/service.go`)

- Wraps repository CRUD helpers and exposes `CreateLibrary`, `UpdateLibrary`, `DeleteLibrary`, `SetLibraryDirectories`, and `ScanLibrary`.
- `ScanLibrary` iterates each enabled directory assigned to the library, creating audiobooks with the correct `LibraryID`.
- `GetLibraries` and `GetLibrary` return enriched data (directories + book counts) used by both the API and the settings UI.

---

## 4. HTTP API (`internal/server`)

### 4.1 Public Library Catalog

```
GET  /api/v1/libraries                    # list libraries (with directory summaries)
GET  /api/v1/libraries/{library_id}       # full library detail
GET  /api/v1/libraries/{library_id}/books # paginated books in the library
GET  /api/v1/libraries/{library_id}/books/search?q=TERM
GET  /api/v1/libraries/{library_id}/books/{book_id}
```

All of the above require authentication (consistent with the rest of the API) and honor pagination parameters `offset` & `limit`.

### 4.2 Personal Library

```
GET    /api/v1/library?library_id={optional}
GET    /api/v1/library/{audiobook_id}
POST   /api/v1/library/add
DELETE /api/v1/library/{audiobook_id}
POST   /api/v1/library/{audiobook_id}/progress
POST   /api/v1/library/{audiobook_id}/favorite
```

These endpoints continue to manage a user’s saved titles and can be optionally scoped to a library via `library_id`.

### 4.3 Admin

```
# Libraries
GET    /api/v1/admin/libraries
POST   /api/v1/admin/libraries
GET    /api/v1/admin/libraries/{id}
PATCH  /api/v1/admin/libraries/{id}
DELETE /api/v1/admin/libraries/{id}
POST   /api/v1/admin/libraries/{id}/directories   (expects body of directory IDs)
POST   /api/v1/admin/libraries/{id}/scan

# Library paths & import configuration (unchanged)
GET/POST/PATCH/DELETE /api/v1/admin/library-paths
GET/POST/PATCH/DELETE /api/v1/admin/import-folders
GET/PUT                /api/v1/admin/import-settings
POST                   /api/v1/admin/import/scan (batch operations)
```

Admins also retain the filesystem browsing + user management endpoints from previous iterations.

The legacy `/api/v1/catalog` routes have been removed; clients must specify a library ID when browsing content.

---

## 5. Frontend

- A global library context (`providers/library-provider.tsx`) fetches `/api/v1/libraries`, stores the active selection, and exposes it via `useLibraryContext`.
- The top bar renders `components/layout/library-selector.tsx`, which reads the context and lets the user choose a library.
- `useCatalogQuery` now hits `/libraries/{id}/books` (or `/books/search`) and converts the response into a `PaginatedResponse<Audiobook>`; search and browse pages are scoped automatically by the selector.
- `/settings` is a dedicated layout with left navigation for General, Libraries, Library Directories, Import, and Import Directories. Each page reuses the existing admin components instead of bespoke forms.
- Legacy `/admin` pages still exist but primarily host operational tools; configuration is accessible via `/settings/*`.

---

## 6. Testing

- `repository_helpers_test.go` covers the JSON (de)serialisation helpers for library settings.
- Manual end-to-end verification: run `go test ./...` and exercise the new `/libraries/{id}/books` routes plus the `/settings` pages to confirm the wiring.
- Future work: add service/handler tests for the new library endpoints once the suite is expanded beyond the repository layer.

---

## 7. Future Enhancements

- Expose write APIs for per-library settings once the UI requires them.
- Add fine-grained access control using the existing `user_library_access` model.
- Expand automated test coverage around the scanning pipeline and new HTTP handlers.
- Evaluate caching for large libraries if pagination becomes a bottleneck.
