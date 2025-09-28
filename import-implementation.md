# Import Audiobooks Implementation Guide

## Overview

This document provides a comprehensive implementation plan for the audiobook import system in Flix-Audio. The system allows administrators to scan library directories, select audio files, and import them into the global catalog.

## Architecture

### Backend APIs Used

The import system leverages these existing backend endpoints:

- **GET /api/v1/admin/scan** - Lists importable items in the library directory
- **POST /api/v1/admin/audiobooks** - Creates new audiobook from source path

### Frontend Implementation

#### 1. Type Definitions (`lib/api/types.ts`)

```typescript
export interface ScanEntry {
  name: string;           // File/directory name
  path: string;           // Relative path from library root
  type: 'file' | 'directory';
  size_bytes?: number;    // File size in bytes
  file_count?: number;    // Number of files in directory
}

export interface ImportRequest {
  source_path: string;    // Path to import from
}

export interface ImportResponse {
  data: Audiobook;        // Created audiobook data
}
```

#### 2. API Hooks (`lib/api/hooks.ts`)

**Query Hook - Library Scan**
```typescript
export const useLibraryScanQuery = () =>
  useQuery({
    queryKey: queryKeys.admin.scan(),
    queryFn: () => apiFetch<{ data: ScanEntry[] }>("/admin/scan"),
    staleTime: 1000 * 30 // 30 seconds
  });
```

**Mutation Hook - Import Audiobook**
```typescript
export const useImportAudiobookMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ImportRequest) =>
      apiFetch<ImportResponse>("/admin/audiobooks", {
        method: "POST",
        body: JSON.stringify(request)
      }),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.catalog.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.library.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.scan() });
    }
  });
};
```

#### 3. UI Components

**ScanResults Component** (`components/admin/scan-results.tsx`)

Features:
- Displays scan results in a clean table format
- Checkboxes for individual and bulk selection
- File type icons (folder, music note, generic file)
- Size and file count badges
- Import status indicators (pending, importing, success, error)
- Sequential import processing with progress tracking

**Import Page** (`app/(dashboard)/admin/import/page.tsx`)

Flow:
1. Initial state shows "Scan Library" button
2. After scanning, displays results with selection interface
3. Shows import progress and completion status
4. Provides navigation to library to see imported books

## User Workflow

### 1. Admin Scans Library

1. Navigate to `/admin/import`
2. Click "Start Library Scan"
3. System calls `GET /admin/scan` to fetch available files
4. Results displayed with selection checkboxes

### 2. Select and Import Files

1. Review scan results showing:
   - File/directory names and paths
   - File sizes and directory file counts
   - File type indicators
2. Select individual items or use "Select All"
3. Click "Import Selected" to begin import process

### 3. Import Processing

1. Selected items processed sequentially
2. For each item:
   - Status changes to "importing"
   - `POST /admin/audiobooks` called with `source_path`
   - Status updates to "success" or "error"
3. Progress tracked visually with icons and status

### 4. Post-Import

1. Successfully imported books appear in global catalog
2. Users can add them to personal libraries
3. Admin can navigate to library to verify imports

## Technical Details

### File Type Detection

The scan results component detects file types:
- **Directories**: Blue folder icon with file count badge
- **Audio files**: Green music note icon for (.mp3, .m4a, .m4b, .flac, .wav, .ogg)
- **Other files**: Gray generic file icon

### Import Status Management

Local state tracks import progress:
```typescript
interface ImportStatus {
  [path: string]: "pending" | "importing" | "success" | "error";
}
```

Status visualization:
- **Importing**: Blue clock icon with spinner
- **Success**: Green checkmark icon
- **Error**: Red alert icon

### Error Handling

- Individual import failures don't stop batch processing
- Failed imports show error status and can be retried
- Network errors display appropriate user feedback
- Validation errors from backend displayed to user

### Performance Considerations

- Scan results cached for 30 seconds to avoid excessive API calls
- Sequential import processing prevents server overload
- Query invalidation ensures fresh data after imports
- Optimistic UI updates provide immediate feedback

## File Structure

```
web/src/
├── lib/api/
│   ├── types.ts (ScanEntry, ImportRequest, ImportResponse)
│   ├── hooks.ts (useLibraryScanQuery, useImportAudiobookMutation)
│   └── queries.ts (admin.scan query key)
├── components/
│   ├── admin/
│   │   └── scan-results.tsx (main import UI component)
│   └── ui/
│       └── checkbox.tsx (selection component)
└── app/(dashboard)/admin/import/
    └── page.tsx (import page with workflow)
```

## Testing Workflow

### Prerequisites
1. Backend server running with library directory configured
2. Sample audiobook files placed in library directory
3. Admin user account with proper permissions

### Test Steps
1. **Setup**: Place test files (MP3, M4B, etc.) in backend library directory
2. **Scan**: Navigate to `/admin/import` and click "Start Library Scan"
3. **Verify**: Confirm test files appear in scan results
4. **Import**: Select files and click "Import Selected"
5. **Monitor**: Watch import progress indicators
6. **Validate**: Navigate to `/library` to see imported audiobooks
7. **Test Playback**: Add book to library and test audio streaming

### Expected Behavior
- Scan finds all audio files and directories
- Import creates audiobook records with extracted metadata
- Imported books appear in global catalog immediately
- Books are playable after being added to user library

## Troubleshooting

### Common Issues

**No files found in scan**
- Verify library directory exists and contains audio files
- Check backend configuration for library path
- Ensure file permissions allow read access

**Import fails with permission errors**
- Verify admin user permissions
- Check authentication token validity
- Confirm API endpoints are accessible

**Files not appearing in library**
- Check query cache invalidation is working
- Refresh library page manually
- Verify backend database was updated

### Debug Information
- Check browser network tab for API call responses
- Monitor backend logs for import processing errors
- Verify ffprobe is available for duration extraction

## Future Enhancements

### Bulk Import
- Implement `POST /admin/scan` for batch processing
- Add import queue with progress tracking
- Support for drag-and-drop file uploads

### Metadata Enrichment
- Automatic metadata matching during import
- Manual metadata linking interface
- Cover art extraction and storage

### Advanced Features
- Import history and audit logs
- Duplicate detection and handling
- File organization and renaming options
- M4B chapter extraction support

## Security Considerations

- Path traversal protection in backend prevents access outside library directory
- Admin-only endpoints protected by authentication middleware
- File validation ensures only audio files are processed
- Symlink resolution prevents directory escape attacks

This implementation provides a complete, user-friendly audiobook import system that integrates seamlessly with the existing Flix-Audio architecture.