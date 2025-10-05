# Metadata System Refactor Plan

This document outlines a comprehensive refactor of the 3-tier metadata system to address critical issues with lock semantics, missing filesystem metadata, and UI clarity.

---

## Current System Analysis

### Architecture
- **Tier 1 (Override)**: `audiobook_metadata_overrides` - Manual edits stored as JSON
- **Tier 2 (Agent)**: `audiobook_metadata_agent` - External provider metadata (Audible, Google Books)
- **Tier 3 (Embedded)**: `audiobook_metadata_embedded` - ID3/M4B file tags (currently stubbed)

### Critical Problems

#### 1. Broken Lock Semantics
- **Issue**: When a field is locked without a custom value, resolution fails
- **Example**: Title set to custom "X" + locked → changed to "agent" + locked → saves `{locked: true}` with no value
- **Result**: `ResolveMetadata()` sees field is locked, skips agent data, displays "unknown"
- **Root Cause**: Locks prevent updates rather than snapshotting values

#### 2. Missing Filesystem Metadata Layer
- **Issue**: Filename/folder parsing results have nowhere to go
- **Gap**: Files without ID3 tags but with structured names like "Author - Title.m4b" lose this information
- **Current Flow**: Parse filename → discard → hope user manually matches

#### 3. Confusing Override Structure
- **Issue**: JSON format `{"field": {"value"?: string, "locked": bool}}` is ambiguous
- **Cases**:
  - `{value: "X", locked: true}` = custom override (works)
  - `{locked: true}` (no value) = broken state
  - `{value: "X", locked: false}` = never happens, confusing

#### 4. No Match Display in Match UI
- **Issue**: Users can't see current metadata match or easily unmatch
- **Gap**: Settings → Metadata page shows matches, but audiobook detail page doesn't show "matched to Audible: Book Title [Unmatch]"

#### 5. Asymmetric Table Schemas
- **Issue**: Each tier has different columns
- **Agent**: `isbn`, `asin`, `publisher`, `rating`, `rating_count`, `genres`
- **Embedded**: `album`, `genre`, `year`, `track_number`, `comment`
- **Override**: JSON blob
- **Result**: Hard to reason about field availability across tiers

---

## Lock Semantics (DECIDED)

### Approach: Lock the VALUE (Plex-style)
**Philosophy**: Locking freezes the current value and converts it to custom, protecting it from future updates.

```
User sees: Title = "Abaddon's Gate" (from Agent)
User clicks lock → Value snapshots to custom table
Agent metadata updates → User still sees "Abaddon's Gate" (locked/frozen)
User unlocks → Value reverts to current agent metadata
```

### Behavior Rules:
1. **Lock = Snapshot to Custom**
   - Current effective value copied to custom table
   - Field automatically switches to "Custom" source
   - Lock icon becomes solid/active
   - Value is now frozen against cascade updates

2. **Unlock = Clear Custom**
   - Delete custom table entry for that field
   - Field reverts to priority cascade (Agent → File → Parsed)
   - Value updates to current effective value from cascade

3. **Typing in Field**
   - Automatically creates custom value
   - Does NOT auto-lock
   - Lock remains available to freeze the typed value

4. **Source Dropdown When Locked**
   - Disabled/grayed out (can't change source of locked field)
   - Shows "Custom (locked from {original_source})"
   - Must unlock to change source

5. **Match/Rematch Behavior**
   - Locked fields are preserved (not overwritten by new match)
   - Show warning: "3 fields are locked and won't update"
   - Option: "Replace all (including locked)" vs "Preserve locked fields"

---

## Phase 1: Quick Fix (Immediate Fixes)

**Goal**: Implement proper lock-to-value semantics and improve match UX without schema changes

### Backend Changes

#### Task 1.1: Fix Override Save Logic
**File**: `backend/internal/server/metadata_handlers.go`

- [ ] Update `handleUpdateAudiobookMetadata` to implement lock-to-value semantics
- [ ] When lock is set to `true`:
  - [ ] Always require a value (snapshot from current effective value)
  - [ ] Store as `{value: "...", locked: true}`
  - [ ] Reject requests with `{locked: true}` and no value
- [ ] When lock is set to `false`:
  - [ ] Delete the override entry entirely (clear custom value)
  - [ ] Return error if trying to save `{value: X, locked: false}` (invalid state)
- [ ] Add validation: locked must have value, unlocked must not have override

**File**: `backend/internal/models/models.go`

- [ ] Update `ResolveMetadata()` to handle lock-to-value semantics
- [ ] Locked fields:
  - [ ] Always use the custom value (override.value)
  - [ ] Ignore agent/embedded/parsed sources
- [ ] Unlocked fields:
  - [ ] Skip if override exists but locked=false (shouldn't happen)
  - [ ] Use priority cascade: Agent → Embedded → Parsed
- [ ] Document lock semantics in comments: "Locked = frozen custom value"

#### Task 1.2: Add Unmatch Endpoint
**File**: `backend/internal/server/metadata_handlers.go`

- [ ] Create `handleUnmatchMetadata` handler
  - [ ] Route: `DELETE /api/v1/admin/audiobooks/:id/metadata/link`
  - [ ] Clear `audiobooks.metadata_id`
  - [ ] Option: preserve locked fields or clear all
  - [ ] Return updated audiobook with resolved metadata
- [ ] Wire up route in `server.go`

**File**: `backend/internal/repository/repository.go`

- [ ] Add `UnlinkAudiobookMetadata(ctx, audiobookID)` method
  - [ ] Set `metadata_id = NULL` for audiobook
  - [ ] Return error if audiobook not found
- [ ] Optional: Add `DeleteAgentDerivedOverrides(ctx, audiobookID)`
  - [ ] For clearing overrides that came from agent if desired

### Frontend Changes

#### Task 1.3: Implement Lock-to-Value UI
**File**: `web/src/app/(dashboard)/library/[id]/page.tsx`

- [ ] Update field state model:
  ```ts
  type FieldState = {
    customValue: string;      // Value in custom/override table
    agentValue: string;        // Value from agent metadata
    fileValue: string;         // Value from embedded/file tags
    parsedValue: string;       // Value from filename parsing (future)
    isLocked: boolean;         // True if custom value exists with lock
    originalSource: string;    // Track where locked value came from
  };
  ```

- [ ] Update `getEffectiveValue()`:
  ```ts
  const getEffectiveValue = (field: FieldState): string => {
    if (field.isLocked) return field.customValue;
    return field.agentValue || field.fileValue || field.parsedValue || "";
  };
  ```

- [ ] Implement lock button behavior:
  - [ ] When clicked on unlocked field:
    - [ ] Get current effective value
    - [ ] Set as customValue
    - [ ] Set isLocked = true
    - [ ] Save to override table with `{value: X, locked: true}`
    - [ ] Disable source dropdown
    - [ ] Show "Custom (locked from {source})" label
  - [ ] When clicked on locked field:
    - [ ] Set isLocked = false
    - [ ] Clear customValue
    - [ ] Delete override from table
    - [ ] Enable source dropdown
    - [ ] Revert to cascade priority

- [ ] Update input field behavior:
  - [ ] On typing:
    - [ ] Set customValue to typed text
    - [ ] Keep isLocked state as-is (typing doesn't auto-lock)
    - [ ] Show unsaved indicator
  - [ ] Source dropdown:
    - [ ] Disabled when isLocked = true
    - [ ] Enabled when isLocked = false
    - [ ] Shows "Custom" when customValue exists
    - [ ] Shows priority source when using cascade

- [ ] Update `handleSaveMetadata()`:
  - [ ] For each field:
    - [ ] If isLocked: save `{value: customValue, locked: true}`
    - [ ] If customValue but !isLocked: save `{value: customValue, locked: false}` (acts as custom tier in cascade)
    - [ ] If no customValue and !isLocked: delete override (use cascade)
  - [ ] Send to API: `POST /api/v1/admin/audiobooks/:id/metadata`

#### Task 1.4: Add Unmatch UI
**File**: `web/src/app/(dashboard)/library/[id]/page.tsx`

- [ ] Add current match indicator to Match tab (top of tab content):
  ```tsx
  {audiobook.metadata_id && (
    <div className="border rounded-lg p-4 mb-4 bg-card">
      <div className="flex items-center gap-4">
        {audiobook.agent_metadata?.cover_url && (
          <img src={...} className="w-16 h-20 rounded" />
        )}
        <div className="flex-1">
          <h4 className="font-semibold">Currently Matched</h4>
          <p className="text-sm text-muted-foreground">
            {audiobook.agent_metadata?.source} - {audiobook.agent_metadata?.title}
          </p>
          <p className="text-xs text-muted-foreground">
            by {audiobook.agent_metadata?.author}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleViewMetadataSource}>
            View Details
          </Button>
          <Button variant="outline" size="sm" onClick={handleUnmatch}>
            <Unlink className="h-4 w-4 mr-1" />
            Unmatch
          </Button>
        </div>
      </div>
    </div>
  )}
  ```

- [ ] Implement `handleUnmatch()`:
  - [ ] Show confirmation dialog
  - [ ] Message: "Remove metadata match? Locked fields will be preserved."
  - [ ] Show count of locked fields
  - [ ] Options:
    - [ ] "Preserve locked fields" (default)
    - [ ] "Clear all fields" (also clears locks)
  - [ ] Call API: `DELETE /api/v1/admin/audiobooks/:id/metadata/link?preserve_locked=true`
  - [ ] Invalidate queries on success

- [ ] Implement `handleMatchMetadata()` updates:
  - [ ] Count currently locked fields before matching
  - [ ] If locked fields exist, show warning:
    - [ ] "Replace match? {N} locked fields will be preserved."
    - [ ] Checkbox: "Also update locked fields"
  - [ ] Proceed with match API call
  - [ ] Refresh metadata display

#### Task 1.5: Improve Match Screen
**File**: `web/src/app/(dashboard)/settings/metadata/page.tsx`

- [ ] Wire up real API calls (replace mock data)
- [ ] Fetch unmatched books:
  - [ ] `GET /api/v1/admin/audiobooks?filter=unmatched`
  - [ ] Show books where `metadata_id IS NULL`
- [ ] Fetch matched books:
  - [ ] `GET /api/v1/admin/audiobooks?filter=matched`
  - [ ] Show books where `metadata_id IS NOT NULL`
- [ ] Implement search:
  - [ ] `GET /api/v1/metadata/search?provider={provider}&title={title}&author={author}`
  - [ ] Display results with covers
- [ ] Implement match:
  - [ ] `POST /api/v1/admin/audiobooks/:id/metadata/link`
  - [ ] Body: `{provider: "audible", external_id: "B123..."}`
- [ ] Add unmatch button to matched books
- [ ] Show match source info: "Matched to Audible (ASIN: B123456)"

### Testing

- [ ] Test lock-to-value behavior:
  - [ ] Lock field from agent → verify value snapshots to custom
  - [ ] Agent metadata updates → verify locked field unchanged
  - [ ] Unlock field → verify reverts to current agent value
  - [ ] Lock field from file → verify value snapshots correctly
  - [ ] Lock field with no source → verify uses empty/fallback

- [ ] Test typing behavior:
  - [ ] Type in unlocked field → verify creates custom value
  - [ ] Save without locking → verify custom value in cascade
  - [ ] Lock after typing → verify value freezes
  - [ ] Unlock typed field → verify reverts to original source

- [ ] Test match/unmatch:
  - [ ] Match book to Audible → verify metadata populates
  - [ ] Lock some fields → match to Google → verify locked preserved
  - [ ] Unmatch book → verify metadata_id cleared
  - [ ] Unmatch with preserve → verify locked fields remain
  - [ ] Unmatch without preserve → verify all fields clear

- [ ] Test edge cases:
  - [ ] Book with only custom locked values (no agent)
  - [ ] Lock all fields then unmatch
  - [ ] Partial overrides with mix of locked/unlocked
  - [ ] Switch between providers with locks

### Documentation

- [ ] Update API docs:
  - [ ] Document unmatch endpoint
  - [ ] Document override semantics (lock = custom snapshot)
  - [ ] Document match behavior with locked fields
- [ ] Add code comments explaining lock-to-value approach
- [ ] Update `CLAUDE.md` with metadata management details
- [ ] Add user-facing docs on locking behavior

---

## Phase 2: Add Parsed Metadata (New Feature)

**Goal**: Add 4th tier for filename/folder-derived metadata

### Database Changes

#### Task 2.1: Add Parsed Metadata Table
**File**: `backend/internal/database/schema.sql`

- [ ] Create `audiobook_metadata_parsed` table:
  ```sql
  CREATE TABLE IF NOT EXISTS audiobook_metadata_parsed (
      audiobook_id TEXT PRIMARY KEY,
      title TEXT NULL,
      subtitle TEXT NULL,
      author TEXT NULL,
      narrator TEXT NULL,
      series_name TEXT NULL,
      series_number TEXT NULL,
      year TEXT NULL,
      parsed_at TEXT NOT NULL,
      FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE
  );
  ```
- [ ] Create migration script to add table
- [ ] Add index: `CREATE INDEX idx_parsed_metadata ON audiobook_metadata_parsed(audiobook_id)`
- [ ] Test migration on dev database

#### Task 2.2: Add Model
**File**: `backend/internal/models/models.go`

- [ ] Define `ParsedMetadata` struct:
  ```go
  type ParsedMetadata struct {
      AudiobookID  string    `json:"audiobook_id"`
      Title        *string   `json:"title,omitempty"`
      Subtitle     *string   `json:"subtitle,omitempty"`
      Author       *string   `json:"author,omitempty"`
      Narrator     *string   `json:"narrator,omitempty"`
      SeriesName   *string   `json:"series_name,omitempty"`
      SeriesNumber *string   `json:"series_number,omitempty"`
      Year         *string   `json:"year,omitempty"`
      ParsedAt     time.Time `json:"parsed_at"`
  }
  ```
- [ ] Add `ParsedMetadata *ParsedMetadata` field to `Audiobook` struct
- [ ] Update `ResolveMetadata()` to include tier 4 (parsed) as lowest priority:
  - Priority: Custom (locked) → Agent → Embedded → Parsed
- [ ] Document tier priority in comments

### Backend Implementation

#### Task 2.3: Filename Parser
**File**: `backend/internal/services/audiobooks/parser.go` (new file)

- [ ] Create `ParseFilename(filename, folderPath string) *ParsedMetadata` function
- [ ] Implement parsing patterns:
  - [ ] `Author - Title.ext` → {author, title}
  - [ ] `Author - Series Name #N - Title.ext` → {author, series_name, series_number, title}
  - [ ] `Title (Year).ext` → {title, year}
  - [ ] `Author/Series Name/Title.ext` → {author, series_name, title} (folder structure)
  - [ ] `Author/Title (Narrated by Narrator).ext` → {author, title, narrator}
- [ ] Handle edge cases:
  - [ ] Multiple authors (e.g., "Author1 & Author2")
  - [ ] Series with subtitle "Series #1 - Title: Subtitle"
  - [ ] Special characters in names
  - [ ] Unicode support
- [ ] Use regex-based extraction with fallbacks
- [ ] Return nil if parsing fails/uncertain
- [ ] Write comprehensive unit tests

#### Task 2.4: Repository Methods
**File**: `backend/internal/repository/repository.go`

- [ ] Add `GetParsedMetadata(ctx, audiobookID) (*ParsedMetadata, error)`
  - [ ] Query `audiobook_metadata_parsed` table
  - [ ] Return nil if no row (no error)
- [ ] Add `SaveParsedMetadata(ctx, *ParsedMetadata) error`
  - [ ] UPSERT parsed metadata
  - [ ] Update `parsed_at` timestamp
- [ ] Update `GetAudiobook()` to LEFT JOIN parsed metadata:
  - [ ] Add parsed fields to SELECT
  - [ ] Populate `ab.ParsedMetadata` if exists
- [ ] Ensure no performance degradation from additional JOIN

#### Task 2.5: Integrate with Scan
**File**: `backend/internal/services/audiobooks/service.go`

- [ ] Update `CreateFromSource()` to parse and save metadata:
  - [ ] Extract filename from `assetPath`
  - [ ] Extract folder structure (parent dirs)
  - [ ] Call `ParseFilename(filename, folderPath)`
  - [ ] If parsing succeeds:
    - [ ] Save to `audiobook_metadata_parsed` table
    - [ ] Log: "Parsed metadata from filename: {fields}"
  - [ ] If parsing fails:
    - [ ] Log: "Could not parse metadata from filename"
    - [ ] Continue without parsed tier
- [ ] Add config option: `ENABLE_FILENAME_PARSING` (default: true)
- [ ] Log parsing results for debugging

### Frontend Changes

#### Task 2.6: Add Parsed Source to UI
**File**: `web/src/app/(dashboard)/library/[id]/page.tsx`

- [ ] Update `FieldState` to include parsed tier:
  ```ts
  type FieldState = {
    customValue: string;
    agentValue: string;
    fileValue: string;
    parsedValue: string;  // NEW
    isLocked: boolean;
    originalSource: 'custom' | 'agent' | 'file' | 'parsed';
  };
  ```

- [ ] Update `getEffectiveValue()` to include parsed fallback:
  ```ts
  if (field.isLocked) return field.customValue;
  return field.agentValue || field.fileValue || field.parsedValue || "";
  ```

- [ ] Update source display label:
  - [ ] Show "Filename/Folder" when value from parsed tier
  - [ ] Add icon: 📁 for parsed source
  - [ ] Tooltip: "Automatically extracted from filename and folder structure"

- [ ] Load parsed metadata from API response:
  - [ ] Map `audiobook.parsed_metadata?.title` → `fieldState.parsedValue`
  - [ ] Handle all parsed fields (title, author, series, etc.)

- [ ] Allow locking parsed values:
  - [ ] Lock button works same way (snapshot to custom)
  - [ ] Label: "Custom (locked from Filename)"

#### Task 2.7: Advanced Tab Updates
**File**: `web/src/app/(dashboard)/library/[id]/page.tsx`

- [ ] Add "Priority 4: Parsed Metadata" section to Advanced tab:
  ```tsx
  <div className="rounded-lg border p-4">
    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
      <Badge variant="outline">Priority 4</Badge>
      Parsed Metadata (Filename/Folder)
    </h4>
    <div className="text-xs text-muted-foreground">
      {audiobook?.parsed_metadata ? (
        <ul className="space-y-1">
          {audiobook.parsed_metadata.title && (
            <li><span className="font-medium">Title:</span> {audiobook.parsed_metadata.title}</li>
          )}
          {audiobook.parsed_metadata.author && (
            <li><span className="font-medium">Author:</span> {audiobook.parsed_metadata.author}</li>
          )}
          {audiobook.parsed_metadata.series_name && (
            <li>
              <span className="font-medium">Series:</span>
              {audiobook.parsed_metadata.series_name}
              {audiobook.parsed_metadata.series_number && ` #${audiobook.parsed_metadata.series_number}`}
            </li>
          )}
        </ul>
      ) : (
        <p>No metadata parsed from filename</p>
      )}
    </div>
  </div>
  ```

- [ ] Show parsing source in metadata layers view
- [ ] Display "Parsed at: {timestamp}" for debugging

### Testing

- [ ] Test filename parsing:
  - [ ] Various filename formats and patterns
  - [ ] Folder-based metadata extraction
  - [ ] Edge cases (special chars, unicode, long names)
  - [ ] Malformed filenames (graceful failure)

- [ ] Test resolution priority:
  - [ ] Verify parsed is lowest priority
  - [ ] Agent overrides parsed ✓
  - [ ] File overrides parsed ✓
  - [ ] Custom overrides all ✓

- [ ] Test UI display:
  - [ ] Parsed source shows correctly
  - [ ] Locking parsed values works
  - [ ] Advanced tab displays parsed metadata
  - [ ] Unlocking reverts to correct cascade

- [ ] Test integration:
  - [ ] Scan creates parsed metadata
  - [ ] Parsed metadata persists correctly
  - [ ] Performance with 1000+ books

### Documentation

- [ ] Document filename parsing patterns in README
- [ ] Add examples of supported formats:
  ```
  Supported patterns:
  - "Author - Title.m4b"
  - "Author - Series #1 - Title.m4b"
  - "Title (Year).m4b"
  - "Author/Series/Title.m4b"
  ```
- [ ] Update API docs with parsed metadata fields
- [ ] Add troubleshooting for parsing issues

---

## Phase 3: Full Normalization (Major Refactor)

**Goal**: Clean schema with mirrored tables and explicit custom table

### Database Schema Redesign

#### Task 3.1: Create Custom Metadata Table
**File**: `backend/internal/database/schema.sql`

- [ ] Create `audiobook_metadata_custom` table (mirrors agent structure):
  ```sql
  CREATE TABLE IF NOT EXISTS audiobook_metadata_custom (
      audiobook_id TEXT PRIMARY KEY,
      title TEXT NULL,
      subtitle TEXT NULL,
      author TEXT NULL,
      narrator TEXT NULL,
      description TEXT NULL,
      cover_url TEXT NULL,
      series_name TEXT NULL,
      series_sequence TEXT NULL,
      release_date TEXT NULL,
      isbn TEXT NULL,
      asin TEXT NULL,
      language TEXT NULL,
      publisher TEXT NULL,
      genres TEXT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT NULL,
      FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
  );
  ```
- [ ] All fields nullable (only store user-provided values)
- [ ] Exact same columns as agent table (symmetric)
- [ ] Add indexes for common queries

#### Task 3.2: Symmetrize Embedded Table
**File**: `backend/internal/database/schema.sql`

- [ ] Add missing fields to `audiobook_metadata_embedded`:
  ```sql
  ALTER TABLE audiobook_metadata_embedded
    ADD COLUMN description TEXT NULL,
    ADD COLUMN series_name TEXT NULL,
    ADD COLUMN series_sequence TEXT NULL,
    ADD COLUMN language TEXT NULL,
    ADD COLUMN publisher TEXT NULL,
    ADD COLUMN isbn TEXT NULL,
    ADD COLUMN asin TEXT NULL,
    ADD COLUMN duration_sec REAL NULL,
    ADD COLUMN rating REAL NULL;
  ```
- [ ] Keep unique fields specific to file tags:
  - [ ] `album`, `track_number`, `comment`, `embedded_cover`
- [ ] Now all core metadata fields exist across all tables
- [ ] Update extraction logic to populate new fields when available

#### Task 3.3: Migration Script
**File**: `backend/cmd/migrate-metadata/main.go` (new file)

- [ ] Create migration tool to convert old → new schema:
  1. [ ] Backup existing database
  2. [ ] Create new `audiobook_metadata_custom` table
  3. [ ] Read all `audiobook_metadata_overrides` records
  4. [ ] For each override with `{value: X, locked: true}`:
     - [ ] Extract field → value mapping
     - [ ] INSERT into `audiobook_metadata_custom` table
  5. [ ] Verify all data migrated correctly
  6. [ ] Drop old `audiobook_metadata_overrides` table
  7. [ ] Run integrity checks

- [ ] Support dry-run mode: `--dry-run` flag
  - [ ] Show what would be migrated without changing DB
  - [ ] Print stats: "X overrides → Y custom fields"

- [ ] Support rollback: `--rollback` flag
  - [ ] Restore from backup
  - [ ] Recreate override table from custom table

- [ ] Add validation:
  - [ ] Check for orphaned records
  - [ ] Verify no data loss
  - [ ] Compare counts before/after

### Backend Refactor

#### Task 3.4: Update Models
**File**: `backend/internal/models/models.go`

- [ ] Replace `MetadataOverrides` with `CustomMetadata`:
  ```go
  type CustomMetadata struct {
      AudiobookID string    `json:"audiobook_id"`
      Title       *string   `json:"title,omitempty"`
      Subtitle    *string   `json:"subtitle,omitempty"`
      Author      *string   `json:"author,omitempty"`
      Narrator    *string   `json:"narrator,omitempty"`
      Description    *string   `json:"description,omitempty"`
      CoverURL       *string   `json:"cover_url,omitempty"`
      SeriesName     *string   `json:"series_name,omitempty"`
      SeriesSequence *string   `json:"series_sequence,omitempty"`
      ReleaseDate    *string   `json:"release_date,omitempty"`
      ISBN        *string   `json:"isbn,omitempty"`
      ASIN        *string   `json:"asin,omitempty"`
      Language    *string   `json:"language,omitempty"`
      Publisher   *string   `json:"publisher,omitempty"`
      Genres      *string   `json:"genres,omitempty"`
      UpdatedAt   time.Time `json:"updated_at"`
      UpdatedBy   *string   `json:"updated_by,omitempty"`
  }
  ```

- [ ] Update `Audiobook` struct:
  - [ ] Remove: `MetadataOverrides *MetadataOverrides`
  - [ ] Remove: `FieldOverride` type
  - [ ] Add: `CustomMetadata *CustomMetadata`

- [ ] Note: Keep `locked` state in UI only, not in DB
  - Locked = field has value in custom table
  - Unlocked = field NULL in custom table

#### Task 3.5: Rewrite Resolution Logic
**File**: `backend/internal/models/models.go`

- [ ] Rewrite `ResolveMetadata()` with new structure:
  ```go
  func (a *Audiobook) ResolveMetadata() *AgentMetadata {
      resolved := &AgentMetadata{}

      // Priority cascade for each field
      for _, field := range MetadataFields {
          var value *string

          // Tier 1: Custom (highest priority)
          if a.CustomMetadata != nil {
              value = a.CustomMetadata.GetField(field)
          }

          // Tier 2: Agent
          if value == nil && a.AgentMetadata != nil {
              value = a.AgentMetadata.GetField(field)
          }

          // Tier 3: Embedded/File
          if value == nil && a.EmbeddedMetadata != nil {
              value = a.EmbeddedMetadata.GetField(field)
          }

          // Tier 4: Parsed (lowest priority)
          if value == nil && a.ParsedMetadata != nil {
              value = a.ParsedMetadata.GetField(field)
          }

          if value != nil {
              resolved.SetField(field, value)
          }
      }

      return resolved
  }
  ```

- [ ] Implement field accessor helpers:
  - [ ] `GetField(fieldName string) *string` for each metadata type
  - [ ] `SetField(fieldName string, value *string)` for resolved metadata
  - [ ] Use reflection or switch statement based on performance needs

- [ ] Remove old `isFieldLocked()` method (no longer needed)
- [ ] Document new resolution algorithm

#### Task 3.6: Update Repository
**File**: `backend/internal/repository/repository.go`

- [ ] Add methods for custom metadata:
  - [ ] `GetCustomMetadata(ctx, audiobookID) (*CustomMetadata, error)`
  - [ ] `SaveCustomMetadata(ctx, *CustomMetadata) error`
  - [ ] `DeleteCustomMetadata(ctx, audiobookID) error`
  - [ ] `DeleteCustomField(ctx, audiobookID, fieldName) error`

- [ ] Update `GetAudiobook()` query:
  - [ ] LEFT JOIN `audiobook_metadata_custom` table
  - [ ] Select all custom fields
  - [ ] Populate `ab.CustomMetadata` if exists

- [ ] Remove old override methods:
  - [ ] `GetMetadataOverrides()`
  - [ ] `SaveMetadataOverrides()`
  - [ ] `DeleteMetadataOverrides()`

- [ ] Optimize query performance:
  - [ ] Consider if all JOINs needed or lazy load
  - [ ] Add appropriate indexes
  - [ ] Test with large datasets

#### Task 3.7: Update Handlers
**File**: `backend/internal/server/metadata_handlers.go`

- [ ] Rewrite `handleUpdateAudiobookMetadata`:
  - [ ] Accept simpler request format:
    ```json
    {
      "custom": {
        "title": "My Custom Title",
        "author": "My Custom Author"
      }
    }
    ```
  - [ ] Note: Only send fields that should be custom (have values)
  - [ ] Null/missing fields = not in custom tier (use cascade)
  - [ ] Save to `audiobook_metadata_custom` table
  - [ ] Return resolved metadata

- [ ] Update unlock behavior:
  - [ ] DELETE individual field from custom table
  - [ ] Or set field to NULL (soft delete)

- [ ] Update response format:
  - [ ] Return full audiobook with all tiers populated
  - [ ] Frontend determines lock state: `customValue != null`

### Frontend Refactor

#### Task 3.8: Update UI State Management
**File**: `web/src/app/(dashboard)/library/[id]/page.tsx`

- [ ] Simplify `FieldState` type:
  ```ts
  type FieldState = {
      customValue: string;   // from custom table
      agentValue: string;    // from agent table
      fileValue: string;     // from embedded table
      parsedValue: string;   // from parsed table
  };
  ```

- [ ] Derive lock state from data:
  ```ts
  const isLocked = (field: FieldState) => {
    return field.customValue !== null && field.customValue !== "";
  };
  ```

- [ ] Update `handleSaveMetadata()`:
  - [ ] Build custom object with only non-null fields
  - [ ] Send: `{custom: {title: "X", author: "Y"}}`
  - [ ] Don't send locked boolean (derived from presence)

- [ ] Simplify lock/unlock logic:
  - [ ] Lock = set customValue, save
  - [ ] Unlock = clear customValue, save

#### Task 3.9: Update Lock UI
**File**: `web/src/app/(dashboard)/library/[id]/page.tsx`

- [ ] Lock button renders based on derived state:
  ```tsx
  const isLocked = field.customValue !== "";

  <Button
    variant="outline"
    size="icon"
    onClick={() => isLocked ? unlockField(fieldName) : lockField(fieldName)}
  >
    {isLocked ? (
      <Lock className="h-4 w-4 text-primary" />
    ) : (
      <LockOpen className="h-4 w-4 text-muted-foreground" />
    )}
  </Button>
  ```

- [ ] Show source indicator:
  - [ ] Locked: "Custom (locked from {originalSource})"
  - [ ] Unlocked: "Agent" | "File" | "Parsed" based on effective value

- [ ] Clean up removed complexity:
  - [ ] Remove source dropdown (was confusing)
  - [ ] Just show where value comes from as label
  - [ ] Lock/unlock to control custom vs cascade

### Testing

- [ ] Test migration:
  - [ ] Run on copy of production database
  - [ ] Verify all overrides converted correctly
  - [ ] Check no data loss
  - [ ] Test rollback procedure

- [ ] Test new resolution logic:
  - [ ] All tier combinations work correctly
  - [ ] Priority cascade respects order
  - [ ] Nulls handled properly

- [ ] Test UI:
  - [ ] Lock/unlock flows intuitive
  - [ ] Source labels accurate
  - [ ] Save behavior correct

- [ ] Performance testing:
  - [ ] Query performance with JOINs
  - [ ] Index effectiveness
  - [ ] Test with 10,000+ books

- [ ] Regression testing:
  - [ ] All existing features work
  - [ ] No breaking changes to API

### Documentation

- [ ] Update schema documentation
- [ ] Document new table structure and relationships
- [ ] Update API docs:
  - [ ] New request/response formats
  - [ ] Removed override endpoints
  - [ ] New custom metadata endpoints
- [ ] Create migration guide:
  - [ ] Steps to run migration
  - [ ] Backup procedures
  - [ ] Rollback instructions
- [ ] Update `CLAUDE.md` with new architecture
- [ ] Add troubleshooting guide for migration issues

---

## Post-Refactor Enhancements (Future Considerations)

### Optional Improvements

#### Metadata Conflict Resolution
- [ ] Track when agent metadata updates
- [ ] Show diff for locked fields: "Agent changed, but you have custom value"
- [ ] Allow reviewing changes: [Keep custom] [Accept agent update]
- [ ] Batch review all conflicts across library

#### Metadata History/Audit Trail
- [ ] Create `metadata_history` table
- [ ] Track all changes: who changed what, when
- [ ] Allow reverting to previous values
- [ ] Show changelog in UI: "Title changed from X to Y by User A"

#### Batch Operations
- [ ] Multi-select audiobooks in library view
- [ ] Bulk match to provider
- [ ] Bulk lock specific fields
- [ ] Find-and-replace for metadata fields
- [ ] Bulk clear custom values

#### Smart Parsing Improvements
- [ ] Learn from user corrections
- [ ] Build pattern database from accepted parses
- [ ] Suggest matches based on parsed data
- [ ] Handle edge cases better (foreign languages, etc.)

#### Metadata Validation
- [ ] Warn about series gaps: "You have #1, #3, #5 - missing #2, #4"
- [ ] Validate ISBN/ASIN checksums
- [ ] Flag suspected duplicates
- [ ] Consistency checks (same series, different authors?)

#### Provider Management
- [ ] Allow multiple agent sources per book
- [ ] Choose preferred provider per field
- [ ] Merge metadata from multiple sources
- [ ] Provider priority settings

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Locking any field snapshots value to custom (no more "unknown")
- [ ] Unlocking field reverts to cascade priority
- [ ] Match tab shows current match with clear unmatch option
- [ ] Typing in field creates custom value (doesn't auto-lock)
- [ ] All existing functionality works without regression
- [ ] Lock semantics clearly documented

### Phase 2 Complete When:
- [ ] Filename/folder parsing extracts metadata correctly
- [ ] Parsed metadata displays as 4th tier in resolution
- [ ] Priority cascade: Custom → Agent → File → Parsed
- [ ] Users can view and lock parsed values
- [ ] Parsing handles common patterns reliably
- [ ] Edge cases fail gracefully

### Phase 3 Complete When:
- [ ] All metadata tables have symmetric/mirrored schemas
- [ ] Custom metadata stored in dedicated table (not JSON)
- [ ] Old override system completely removed
- [ ] Migration runs successfully on production data
- [ ] No performance degradation
- [ ] Cleaner, more maintainable codebase
- [ ] Lock state derived from data (not stored separately)

---

## Rollback Plan

### Phase 1 Rollback
- Revert code changes via git
- No schema changes, so no database rollback needed
- Restore override behavior to old (broken) logic if needed

### Phase 2 Rollback
- Drop `audiobook_metadata_parsed` table
- Remove parsing code from scan logic
- No impact on existing metadata
- Safe rollback, no data loss

### Phase 3 Rollback
- **CRITICAL: Requires database backup before migration**
- Restore database from backup (pre-migration)
- Or run reverse migration:
  - Recreate `audiobook_metadata_overrides` table
  - Convert `audiobook_metadata_custom` → JSON overrides
  - Drop new custom table
- Revert all code changes
- Test thoroughly after rollback
