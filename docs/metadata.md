# Metadata System

Flix Audio uses a **3-tier layered metadata system** inspired by Plex, where metadata from multiple sources is merged with a clear priority hierarchy. This allows users to benefit from rich external metadata while maintaining manual control over specific fields through field-level locking.

## Overview

Metadata is resolved from three layers, applied in priority order:

1. **Manual Overrides** (Tier 1) - User edits via UI - highest priority
2. **Agent Metadata** (Tier 2) - External providers (Audible, Google Books, etc.)
3. **Embedded Metadata** (Tier 3) - ID3/M4B file tags - *currently stubbed*

The system includes **field-level locking** to prevent specific metadata fields from being overwritten during agent refreshes.

## Database Schema

### Three Tables

```sql
-- Agent metadata from external providers (SHARED across audiobooks)
CREATE TABLE audiobook_metadata_agent (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    narrator TEXT NULL,
    description TEXT NULL,
    cover_url TEXT NULL,
    series_info TEXT NULL,
    -- ... additional fields
    source TEXT NOT NULL,           -- 'audible', 'google', etc.
    external_id TEXT NULL
);

-- Embedded metadata from file tags (1:1 with audiobook)
CREATE TABLE audiobook_metadata_embedded (
    audiobook_id TEXT PRIMARY KEY,
    title TEXT NULL,
    author TEXT NULL,
    narrator TEXT NULL,
    -- ... ID3/M4B tag fields
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id)
);

-- Manual overrides with field-level locking (1:1 with audiobook)
CREATE TABLE audiobook_metadata_overrides (
    audiobook_id TEXT PRIMARY KEY,
    overrides TEXT NOT NULL,        -- JSON: {"field": {"value": "...", "locked": true}}
    updated_at TEXT NOT NULL,
    updated_by TEXT NULL,
    FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id)
);
```

### Audiobook Links

```sql
CREATE TABLE audiobooks (
    id TEXT PRIMARY KEY,
    metadata_id TEXT NULL,          -- Links to audiobook_metadata_agent
    -- ...
    FOREIGN KEY (metadata_id) REFERENCES audiobook_metadata_agent(id)
);
```

## Field Locking

### Lock Behavior

Field locking prevents specific metadata fields from being overwritten during agent matches or refreshes.

**Two lock modes:**

1. **Locked with custom value** - User edited field
   ```json
   {"title": {"value": "Custom Title", "locked": true}}
   ```
   - Displays: "Custom Title"
   - Agent refreshes: Won't change title (locked)

2. **Locked without value** - Preserves current value
   ```json
   {"narrator": {"locked": true}}
   ```
   - Displays: Current narrator from agent metadata
   - Agent refreshes: Won't change narrator (locked)

### Auto-Lock on Edit

When a user edits a field, it is automatically locked. This is handled by the **frontend**:

```typescript
// Frontend auto-lock logic
onChange={(e) => {
  setValue(e.target.value)
  setLocked(true)  // Auto-lock when user types
}}
```

Users can manually unlock fields before saving, allowing agent metadata to update that field in the future.

## Metadata Resolution

The `ResolveMetadata()` method merges all layers with proper priority:

### Resolution Algorithm

```go
func (a *Audiobook) ResolveMetadata() *AgentMetadata {
    resolved := &AgentMetadata{}

    // Tier 3: Embedded metadata (lowest priority)
    // Currently stubbed - future implementation

    // Tier 2: Agent metadata (only if field NOT locked)
    if a.Metadata != nil {
        if !a.isFieldLocked("title") {
            resolved.Title = a.Metadata.Title
        }
        if !a.isFieldLocked("author") {
            resolved.Author = a.Metadata.Author
        }
        // ... etc for all fields
    }

    // Tier 1: Manual overrides (highest priority, always wins)
    if a.MetadataOverrides != nil {
        if override, ok := a.MetadataOverrides.Overrides["title"]; ok && override.Value != nil {
            resolved.Title = *override.Value
        }
        // ... etc for all fields
    }

    return resolved
}
```

### Lock Checking

```go
func (a *Audiobook) isFieldLocked(fieldName string) bool {
    if a.MetadataOverrides == nil {
        return false
    }
    override, ok := a.MetadataOverrides.Overrides[fieldName]
    return ok && override.Locked
}
```

## API Endpoints

### Update Metadata

Save manual overrides with lock state:

```http
PATCH /api/v1/admin/audiobooks/:id/metadata
```

**Request:**
```json
{
  "overrides": {
    "title": {
      "value": "Project Hail Mary (Unabridged)",
      "locked": true
    },
    "narrator": {
      "locked": true
    },
    "author": {
      "value": "Andy Weir",
      "locked": false
    }
  }
}
```

**Response:** Updated audiobook with resolved metadata

### Clear Overrides

Remove all manual overrides and locks:

```http
DELETE /api/v1/admin/audiobooks/:id/metadata/overrides
```

**Response:** 204 No Content

### Get Metadata Layers

Debug endpoint to view all metadata layers separately:

```http
GET /api/v1/admin/audiobooks/:id/metadata/layers
```

**Response:**
```json
{
  "agent_metadata": {
    "id": "meta-123",
    "title": "Project Hail Mary",
    "author": "Andy Weir",
    "source": "audible"
  },
  "embedded_metadata": null,
  "metadata_overrides": {
    "audiobook_id": "book-456",
    "overrides": {
      "title": {
        "value": "Project Hail Mary (Unabridged)",
        "locked": true
      }
    }
  }
}
```

### Extract Embedded Metadata

Trigger embedded metadata extraction (currently stubbed):

```http
POST /api/v1/admin/audiobooks/:id/metadata/extract
```

**Response:**
```json
{
  "status": "not_implemented",
  "message": "Embedded metadata extraction is not yet implemented"
}
```

## Shared Agent Metadata

Agent metadata can be **shared across multiple audiobooks**. This is useful when:

- Same book in different formats (MP3 vs M4B)
- Different editions (abridged vs unabridged)
- Multiple languages of the same book

**Example:**
```
Audiobook A: "Project Hail Mary.mp3"
Audiobook B: "Project Hail Mary.m4b"
Both link to → audiobook_metadata_agent (id: "meta-123")
```

Each audiobook can still have **different manual overrides**:
- Audiobook A: Title locked as "Project Hail Mary (MP3)"
- Audiobook B: Title locked as "Project Hail Mary (Unabridged)"

## User Workflows

### Scenario 1: User Edits Title

1. User opens edit dialog
2. Changes title to "Project Hail Mary (Unabridged)"
3. Frontend auto-sets `locked: true`
4. User clicks "Save"
5. Backend saves: `{"title": {"value": "...", "locked": true}}`
6. Future agent refreshes won't change title (locked)

### Scenario 2: User Locks Without Editing

1. User clicks lock icon next to "Narrator" field
2. Frontend sets: `locked: true` (no value)
3. User clicks "Save"
4. Backend saves: `{"narrator": {"locked": true}}`
5. Display shows current narrator from agent metadata
6. Future agent refreshes won't change narrator (locked)

### Scenario 3: User Unlocks Field

1. User clicks unlock icon next to "Title" field
2. Frontend sets: `locked: false`
3. User clicks "Save"
4. Backend saves: `{"title": {"value": "Custom", "locked": false}}`
5. Display shows "Custom" (for now)
6. Next agent refresh **can overwrite** title (unlocked)

**Note:** Unlocking does NOT delete the custom value. The value remains until the next agent refresh overwrites it.

### Scenario 4: Agent Match/Refresh

1. User matches audiobook to new agent metadata
2. System checks each field:
   - If locked → Skip, keep current value
   - If unlocked → Update from new agent metadata
3. Preview shows which fields will change
4. User confirms match

## Data Models

### Go Structs

```go
// Field override with lock support
type FieldOverride struct {
    Value  *string `json:"value,omitempty"`   // nil = no override, just locked
    Locked bool    `json:"locked"`             // true = prevent agent updates
}

// Agent metadata (can be shared)
type AgentMetadata struct {
    ID          string   `json:"id"`
    Title       string   `json:"title"`
    Author      string   `json:"author"`
    Narrator    *string  `json:"narrator,omitempty"`
    Description *string  `json:"description,omitempty"`
    CoverURL    *string  `json:"cover_url,omitempty"`
    Source      string   `json:"source"`          // 'audible', 'google', etc.
    ExternalID  *string  `json:"external_id,omitempty"`
    // ... additional fields
}

// Embedded metadata (1:1 with audiobook)
type EmbeddedMetadata struct {
    AudiobookID string   `json:"audiobook_id"`
    Title       *string  `json:"title,omitempty"`
    Author      *string  `json:"author,omitempty"`
    Narrator    *string  `json:"narrator,omitempty"`
    // ... ID3 tag fields
}

// Manual overrides (1:1 with audiobook)
type MetadataOverrides struct {
    AudiobookID string                   `json:"audiobook_id"`
    Overrides   map[string]FieldOverride `json:"overrides"`
    UpdatedAt   time.Time                `json:"updated_at"`
    UpdatedBy   *string                  `json:"updated_by,omitempty"`
}

// Audiobook with all metadata layers
type Audiobook struct {
    ID                string              `json:"id"`
    MetadataID        *string             `json:"metadata_id,omitempty"`
    AgentMetadata     *AgentMetadata      `json:"agent_metadata,omitempty"`
    EmbeddedMetadata  *EmbeddedMetadata   `json:"embedded_metadata,omitempty"`
    MetadataOverrides *MetadataOverrides  `json:"metadata_overrides,omitempty"`

    // Resolved metadata (computed from all layers)
    Metadata          *AgentMetadata      `json:"metadata,omitempty"`
}
```

### TypeScript Types

```typescript
interface FieldOverride {
  value?: string;
  locked: boolean;
}

interface AgentMetadata {
  id: string;
  title: string;
  author: string;
  narrator?: string;
  description?: string;
  cover_url?: string;
  source: string;
  external_id?: string;
}

interface MetadataOverrides {
  audiobook_id: string;
  overrides: Record<string, FieldOverride>;
  updated_at: string;
  updated_by?: string;
}

interface Audiobook {
  id: string;
  metadata_id?: string;
  agent_metadata?: AgentMetadata;
  metadata_overrides?: MetadataOverrides;

  // Resolved metadata for display
  metadata?: AgentMetadata;
}
```

## Frontend Integration

### Edit Dialog Example

```typescript
function EditMetadataDialog({ audiobook }) {
  const [title, setTitle] = useState(audiobook.metadata?.title || '')
  const [titleLocked, setTitleLocked] = useState(false)

  // Auto-lock on edit
  const handleTitleChange = (value: string) => {
    setTitle(value)
    setTitleLocked(true)  // Auto-lock when user types
  }

  // Manual lock toggle
  const toggleTitleLock = () => {
    setTitleLocked(!titleLocked)
  }

  // Save
  const handleSave = async () => {
    await updateAudiobookMetadata(audiobook.id, {
      overrides: {
        title: {
          value: title,
          locked: titleLocked
        }
      }
    })
  }

  return (
    <Dialog>
      <Input
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
      />
      <LockButton
        locked={titleLocked}
        onClick={toggleTitleLock}
      />
      <Button onClick={handleSave}>Save</Button>
    </Dialog>
  )
}
```

### API Client

```typescript
export async function updateAudiobookMetadata(
  audiobookId: string,
  data: { overrides: Record<string, FieldOverride> }
) {
  return apiFetch(`/admin/audiobooks/${audiobookId}/metadata`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function clearMetadataOverrides(audiobookId: string) {
  return apiFetch(`/admin/audiobooks/${audiobookId}/metadata/overrides`, {
    method: 'DELETE',
  })
}
```

## Implementation Status

### Completed ✅
- Database schema (3 tables)
- Field locking data structure
- Repository CRUD operations
- `ResolveMetadata()` with lock checking
- `isFieldLocked()` helper method
- HTTP handlers for save/clear/get layers
- Agent metadata sharing capability

### Stubbed / Future 🚧
- Embedded metadata extraction (ffprobe/ID3 parsing)
- Embedded metadata layer in resolution
- Agent matching UI with preview
- Lock indicators in UI
- "Clear locks" vs "Clear overrides" separation

## Architecture Notes

### Why Share Agent Metadata?

Agent metadata is shared to:
1. Avoid duplicate API calls for same book in different formats
2. Save storage (descriptions, cover URLs shared)
3. Consistent metadata across editions
4. Efficient updates (update once, all linked audiobooks benefit)

### Why NOT Share Embedded/Overrides?

- **Embedded**: Each file has different ID3 tags (1:1 relationship)
- **Overrides**: Users may want different edits per edition (1:1 relationship)

### Performance Considerations

- Three-table joins may impact query performance
- Consider adding resolved metadata cache if needed
- BLOB storage for embedded covers can increase DB size
- May need file storage alternative for cover art

## References

- Implementation: `backend/internal/models/models.go:229-366`
- Handlers: `backend/internal/server/metadata_handlers.go`
- Repository: `backend/internal/repository/repository.go`
- Schema: `backend/internal/database/schema.sql`
- Design doc: `METADATA.md`
