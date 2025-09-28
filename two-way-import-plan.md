# Two-Way Import System Implementation Plan

## Overview
Implement a dual import system for Flix-Audio:
1. **Library Directory** - Auto-scan and in-place import (current functionality)
2. **Source Directories** - Browse external directories and copy files into library

## Current State Analysis

**Backend:**
- Only supports scanning/importing from single `LIBRARY_DIR`
- `CreateFromSource()` validates paths are within library root
- No file copying functionality exists
- Files remain in original location after import

**Frontend:**
- Single scan operation for library directory
- Import creates DB records but doesn't move files
- No concept of multiple source directories

## Implementation Plan

### Phase 1: Backend - Multi-Source Support

#### 1.1 Update Configuration (`config/config.go`)
```go
type Config struct {
    // ... existing fields
    LibraryDir    string
    SourceDirs    []string  // NEW: comma-separated list of source directories
    ImportMode    string    // NEW: "link" or "copy" (default: "link")
}

// Load from env: SOURCE_DIRS="/downloads,/media/external"
// Load from env: IMPORT_MODE="copy"
```

#### 1.2 Create Import Service (`services/import/service.go`)
```go
type ImportService struct {
    libraryDir string
    sourceDirs []string
    scanner    *library.Scanner
}

// Methods:
// - ScanSources() - Scan all configured source directories
// - ScanLibrary() - Scan library directory (existing)
// - ImportFromSource(sourcePath, copyMode bool) - Import with optional copy
// - CopyToLibrary(sourcePath) - Copy files to library/imported/
```

#### 1.3 Add Copy Functionality
```go
func (s *ImportService) CopyToLibrary(sourcePath string) (string, error) {
    // 1. Validate source path is within allowed source dirs
    // 2. Create destination: libraryDir/imported/[timestamp]_[name]
    // 3. Copy file(s) recursively if directory
    // 4. Return new path within library
}
```

#### 1.4 New API Endpoints
```go
// GET /api/v1/admin/sources - List configured source directories
// GET /api/v1/admin/sources/scan?path=/downloads - Scan specific source
// POST /api/v1/admin/import - Enhanced import with mode option
{
    "source_path": "/downloads/audiobook.m4b",
    "import_mode": "copy" | "link",
    "destination": "optional/subfolder"  // within library
}
```

#### 1.5 Update Admin Handlers
- `handleSourcesList()` - Return configured source directories
- `handleSourceScan()` - Scan specific source directory
- `handleEnhancedImport()` - Import with copy/link option

### Phase 2: Frontend - Enhanced Import UI

#### 2.1 Update Types (`lib/api/types.ts`)
```typescript
export interface SourceDirectory {
  path: string;
  name: string;
  type: 'library' | 'source';
}

export interface ImportOptions {
  source_path: string;
  import_mode: 'copy' | 'link';
  destination?: string;
}

export interface EnhancedScanEntry extends ScanEntry {
  source_type: 'library' | 'source';
  source_dir: string;
}
```

#### 2.2 Add New API Hooks (`lib/api/hooks.ts`)
```typescript
// Get configured source directories
export const useSourceDirectoriesQuery = () => {...}

// Scan specific source
export const useSourceScanQuery = (sourcePath: string) => {...}

// Enhanced import with options
export const useEnhancedImportMutation = () => {...}
```

#### 2.3 Create Source Browser Component (`components/admin/source-browser.tsx`)
- Tabbed interface: "Library" | "Source Directories"
- Browse source directories with breadcrumb navigation
- File/folder selection with preview
- Copy vs Link toggle
- Destination folder input (optional)

#### 2.4 Update Import Page (`admin/import/page.tsx`)
```typescript
// New UI structure:
<Tabs>
  <TabsList>
    <TabsTrigger>Library Scan</TabsTrigger>
    <TabsTrigger>Import from Sources</TabsTrigger>
    <TabsTrigger>Configure Sources</TabsTrigger>
  </TabsList>

  <TabsContent value="library">
    // Existing library scan (in-place import)
  </TabsContent>

  <TabsContent value="sources">
    // New source browser with copy option
    <SourceBrowser />
  </TabsContent>

  <TabsContent value="configure">
    // Display configured sources
    // Future: Add/remove sources UI
  </TabsContent>
</Tabs>
```

#### 2.5 Import Flow Components
```typescript
// ImportModeSelector - Radio buttons for copy/link
// DestinationPicker - Optional subfolder within library
// ImportProgress - Show copy progress for large files
// ImportSummary - Post-import report with locations
```

### Phase 3: Database Schema Updates

#### 3.1 Track Import Method (Optional)
```sql
ALTER TABLE audiobooks ADD COLUMN import_method TEXT DEFAULT 'link';
ALTER TABLE audiobooks ADD COLUMN original_source TEXT;
```

#### 3.2 Import History Table (Optional)
```sql
CREATE TABLE import_history (
    id TEXT PRIMARY KEY,
    audiobook_id TEXT REFERENCES audiobooks(id),
    source_path TEXT NOT NULL,
    destination_path TEXT,
    import_method TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    imported_by TEXT REFERENCES users(id)
);
```

### Phase 4: File Organization

#### 4.1 Library Directory Structure
```
library/
├── imported/          # Copied files go here
│   ├── 2024-01-15_Project_Hail_Mary/
│   └── 2024-01-16_Dune.m4b
├── manual/           # Manually placed files
└── [existing files]  # Already in library
```

#### 4.2 Naming Convention for Copied Files
- Single file: `[date]_[original_name]`
- Directory: `[date]_[directory_name]/`
- Preserve internal structure for multi-file audiobooks

## Implementation Steps

### 1. Backend Source Directories
- Add SOURCE_DIRS config
- Create ImportService
- Add file copy utilities
- Implement source scanning

### 2. API Enhancements
- Add source list endpoint
- Add source scan endpoint
- Enhance import endpoint with options
- Update validation logic

### 3. Frontend Source Browser
- Create source directory tabs
- Build file browser component
- Add import mode selector
- Implement copy progress UI

### 4. Integration Testing
- Test library scan (existing)
- Test source browsing
- Test copy imports
- Test link imports
- Verify path security

## Security Considerations

### 1. Path Validation
- Validate source paths are within configured directories
- Prevent path traversal attacks
- Sanitize file names when copying

### 2. Permission Checks
- Ensure read access to source directories
- Ensure write access to library/imported/
- Admin-only access to import features

### 3. Resource Management
- Implement file size limits for copies
- Add progress tracking for large transfers
- Handle disk space errors gracefully

## Benefits

1. **Flexibility** - Support both in-place and copy workflows
2. **Safety** - Original files remain untouched with copy mode
3. **Organization** - Centralized library with clear structure
4. **Automation** - Support for download clients and external sources
5. **User Choice** - Let users decide copy vs link per import

## Example Workflows

### Workflow 1: Library Directory (Current)
1. User places files directly in `library/` directory
2. Admin goes to Import page → "Library Scan" tab
3. Click "Scan Library" to find new files
4. Select and import (files stay in place)

### Workflow 2: Source Directory (New)
1. Download client saves to `/downloads/audiobooks/`
2. Admin goes to Import page → "Import from Sources" tab
3. Browse to `/downloads/audiobooks/New_Book/`
4. Select import mode: "Copy" (moves to `library/imported/`)
5. Import creates audiobook record pointing to new location

### Workflow 3: Mixed Approach
1. Some books in library directory (direct placement)
2. Some books from download sources (copied in)
3. All books appear in unified catalog
4. Users don't need to know the source method

This implementation provides the two-way import system you requested while maintaining backward compatibility with the existing library scan functionality.