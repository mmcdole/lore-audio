# Flix-Audio Web Application Plan

## Overview
A modern, responsive web application for audiobook streaming and management, aligned with the current API implementation and future roadmap from update.md.

## 1. Tech Stack

### Core Framework
- **Next.js 14** with App Router and TypeScript
- **Tailwind CSS** for styling
- **Shadcn/ui** for component library
- **React Query (TanStack Query)** for API state management
- **Zustand** for client state (player, UI preferences)

### Essential Libraries
- **Howler.js** or **wavesurfer.js** for advanced audio playback
- **React Hook Form** + **Zod** for forms
- **Lucide React** for icons
- **Framer Motion** for smooth animations
- **React Virtual** for virtualizing long lists

## 2. Design System

### Theme
```css
/* Modern dark theme with glass morphism effects */
--background: #0a0a0b
--surface: #141416
--surface-hover: #1c1c1f
--primary: #6366f1 /* Indigo */
--accent: #f97316 /* Orange for CTAs */
--text-primary: #f4f4f5
--text-secondary: #a1a1aa
--border: #27272a
--glass: rgba(255, 255, 255, 0.05)

/* Light mode variants */
--light-background: #ffffff
--light-surface: #f8f9fa
```

### Typography
- Primary: 'Inter', -apple-system, sans-serif
- Display: 'Plus Jakarta Sans' for headings
- Consistent scale: text-xs through text-4xl

## 3. Application Routes

Current + Future aligned with update.md:

```
/                      # Home dashboard (continue listening, recent, etc.)
/login                 # Authentication
/register             # New user registration

# Core Navigation
/home                 # Personal dashboard
/library              # Browse all audiobooks (catalog)
/library/[id]         # Audiobook details
/series               # Browse by series (future)
/series/[id]          # Series details (future)
/authors              # Browse by author (future)
/authors/[id]         # Author page (future)
/collections          # User collections (future)
/collections/[id]     # Collection details (future)

# User Areas
/player               # Full-screen player view
/search               # Advanced search page
/profile              # User settings
/stats                # Listening statistics

# Admin
/admin                # Admin dashboard
/admin/import         # Import & scan management
/admin/users          # User management
/admin/metadata       # Metadata matching (future)
/admin/tasks          # Background tasks monitor (future)
```

## 4. Page Layouts

### 4.1 Login Page
Modern glass-morphism design:
- Animated gradient background
- Centered card with blur effect
- Username/password fields with icons
- Remember me checkbox
- Submit with loading state
- Link to register (if enabled)

### 4.2 Main Layout
```
┌─────────────────────────────────────────────────┐
│       Top Bar (search, notifications, user)      │
├──────────┬────────────────────────────────────────┤
│          │                                        │
│ Sidebar  │         Content Area                   │
│          │                                        │
│ 🏠 Home  │   Dynamic content based on route       │
│ 📚 Library│                                        │
│ 📖 Series │   - Hero sections                     │
│ ✍️ Authors│   - Grid layouts                      │
│ 📁 Collections   - List views                     │
│          │   - Detail pages                       │
│ ────────│                                        │
│ ⚙️ Settings                                       │
│ 👤 Admin │                                        │
│          │                                        │
├──────────┴────────────────────────────────────────┤
│         Mini Player (persistent when playing)     │
└─────────────────────────────────────────────────┘
```

### 4.3 Home Dashboard
**Hero Section:**
- Currently reading with large cover
- Resume button with progress
- Quick stats (books, time listened)

**Sections:**
1. Continue Listening (horizontal scroll)
2. Recently Added to Library
3. Recent Activity
4. Recommended (based on listening)

### 4.4 Library Page (All Books)
**Features:**
- View toggle: Grid / List / Compact
- Sort: Title, Author, Recently Added, Duration
- Filters sidebar:
  - In My Library
  - Duration ranges
  - Has metadata
  - File type
- Search bar with instant results
- Infinite scroll or pagination

**Book Cards Show:**
- Cover with hover effect
- Title, author, narrator
- Duration badge
- Series badge (if applicable)
- Progress ring (if in user library)
- Quick actions on hover

### 4.5 Series Page (Future)
- Series grid with cover collages
- Book count badges
- Progress indicators
- Expandable series view

### 4.6 Authors Page (Future)
- Author cards with images
- Book count
- Total duration
- Popular books preview

### 4.7 Collections Page (Future)
- User-created collections
- Shared collections (if public)
- Smart collections (auto-generated)
- Drag-and-drop organization

### 4.8 Audiobook Detail Page
**Layout:**
```
┌──────────┬──────────────────────┐
│  Cover   │  Title               │
│  (large) │  Author(s)           │
│          │  Narrator(s)         │
│          │  Series • Book #     │
│          │  Duration • Files    │
│          │                      │
│          │  [▶ Play] [+ Library]│
│          │  [♥] [⚙] [Share]    │
├──────────┴──────────────────────┤
│  Description                     │
│  ...                            │
├──────────────────────────────────┤
│  Chapters/Files                  │
│  □ 1. Chapter One      45:23    │
│  □ 2. Chapter Two      38:12    │
├──────────────────────────────────┤
│  Similar Books                   │
└──────────────────────────────────┘
```

### 4.9 Player Page
**Full-Screen Player:**
- Blurred background from cover
- Large cover art (animated rotation optional)
- Waveform visualization option
- Chapter markers on progress bar
- Queue management
- Lyrics/transcript view (future)
- Sleep timer
- Bookmarks

### 4.10 Admin Pages
**Import Management:**
- Drag-and-drop zone
- Directory browser
- Import queue with progress
- Metadata matching interface
- Batch operations

**User Management:**
- User table with filters
- Quick stats per user
- Listening history
- Admin privileges toggle

**Task Monitor:**
- Active tasks with progress
- Task history
- Cancel/retry actions
- Real-time updates via WebSocket

## 5. Component Architecture

### Core Components

```typescript
// Layout Components
<AppShell />         // Main layout wrapper
<Sidebar />          // Collapsible navigation
<TopBar />           // Search, user menu
<MiniPlayer />       // Persistent player
<MobileNav />        // Bottom nav for mobile

// Book Components
<BookCard />         // Grid/list item
<BookCover />        // Lazy loaded covers
<BookGrid />         // Responsive grid
<BookList />         // List view
<BookDetails />      // Full details
<BookCarousel />     // Horizontal scroll

// Player Components
<AudioPlayer />      // Full controls
<ProgressBar />      // Seekable progress
<ChapterList />      // Chapter navigation
<PlaybackSpeed />    // Speed selector
<VolumeControl />    // Volume slider
<QueueManager />     // Up next queue

// Data Display
<StatCard />         // Dashboard stats
<ProgressRing />     // Visual progress
<DurationBadge />    // Formatted duration
<SeriesBadge />      // Series indicator

// Forms & Inputs
<SearchBar />        // Global search
<FilterPanel />      // Multi-select filters
<SortDropdown />     // Sort options
<ViewToggle />       // Grid/list toggle

// Feedback
<LoadingSkeleton />  // Content placeholders
<ErrorBoundary />    // Error handling
<Toast />            // Notifications
<ConfirmDialog />    // Confirmation modals
```

## 6. State Management

### Global State (Zustand)
```typescript
interface AppState {
  // User
  user: User | null
  isAuthenticated: boolean

  // Player
  currentBook: AudioBook | null
  currentFile: MediaFile | null
  currentTime: number
  duration: number
  isPlaying: boolean
  playbackRate: number
  volume: number
  queue: QueueItem[]

  // UI
  theme: 'light' | 'dark' | 'system'
  sidebarCollapsed: boolean
  viewMode: 'grid' | 'list' | 'compact'

  // Preferences
  autoplay: boolean
  saveProgress: boolean
  skipSilence: boolean
}
```

### Server State (React Query)
```typescript
// Core queries matching API
useCatalog({ page, limit, search, filters })
useAudiobook(id)
useLibrary()
useLibraryBook(id)
useUserProfile()
useAdminStats()

// Future queries (from update.md)
useSeries()
useAuthors()
useCollections()
useTasks()
useMetadataSearch(query)

// Mutations
useAddToLibrary()
useRemoveFromLibrary()
useUpdateProgress()
useToggleFavorite()
useImportBooks()
useMatchMetadata()
```

## 7. Advanced Features

### Smart Features
**Auto-bookmark on pause** - Save position when pausing
**Speed per book** - Remember playback speed preferences
**Smart resume** - Rewind 10s when resuming after long pause
**Chapter skip** - Skip intro/outro based on patterns
**Silence trimming** - Auto-skip long silences

### Keyboard Shortcuts
```
Space     - Play/pause
← / →     - Skip 10s back/forward
↑ / ↓     - Volume up/down
Shift + ← / → - Previous/next chapter
M         - Mute
F         - Fullscreen player
/         - Focus search
L         - Toggle library view
S         - Toggle sidebar
1-5       - Playback speed presets
```

### Offline Support (Progressive Web App)
- Service worker for offline access
- Cache book metadata and covers
- Download chapters for offline play
- Background sync for progress

### Accessibility
- Full keyboard navigation
- Screen reader support
- ARIA labels and roles
- Focus management
- High contrast mode
- Reduced motion option

## 8. Audio Player Implementation

### Enhanced Player Features
```typescript
// Advanced audio handling
class AudiobookPlayer {
  // Core playback
  play(): void
  pause(): void
  seek(time: number): void

  // Navigation
  skipForward(seconds: number = 10): void
  skipBackward(seconds: number = 10): void
  nextChapter(): void
  previousChapter(): void

  // Advanced features
  setPlaybackRate(rate: number): void
  trimSilence(enabled: boolean): void
  setSleepTimer(minutes: number): void
  addBookmark(note?: string): void

  // Progress tracking
  autoSaveProgress(): void
  syncProgress(): Promise<void>

  // Queue management
  addToQueue(items: MediaFile[]): void
  clearQueue(): void
  playNext(): void
}
```

### Visualizations
- Waveform display with peaks
- Chapter markers on timeline
- Current chapter highlight
- Buffer progress indicator

## 9. Search & Discovery

### Advanced Search
- Multi-field search (title, author, narrator, series)
- Search suggestions/autocomplete
- Recent searches
- Search filters
- Highlighted results

### Discovery Features
- "More by this author"
- "More in this series"
- "Similar books"
- "Listeners also enjoyed"
- Trending in library
- New additions

## 10. Performance Optimizations

### Critical Optimizations
- Virtual scrolling for large lists
- Image lazy loading with blur placeholders
- Code splitting by route
- Prefetch on hover
- Optimistic UI updates
- Debounced search
- Memoized expensive operations

### Caching Strategy
- React Query: 5min cache, 10min stale
- Images: Browser cache + CDN
- Audio: Range requests for streaming
- LocalStorage: User preferences
- IndexedDB: Offline data

## 11. Mobile Experience

### Responsive Breakpoints
```
sm: 640px   - Mobile landscape
md: 768px   - Tablet portrait
lg: 1024px  - Tablet landscape
xl: 1280px  - Desktop
2xl: 1536px - Large screens
```

### Mobile Optimizations
- Touch gestures (swipe to seek)
- Bottom tab navigation
- Pull to refresh
- Larger touch targets
- Simplified layouts
- Reduced data usage mode

### Mobile-Specific Features
- Lock screen controls
- Bluetooth controls support
- Car mode (simplified, large controls)
- Picture-in-picture video covers

## 12. Implementation Roadmap

### Phase 1: Core Foundation (Week 1)
- [x] Authentication flow
- [x] Basic layout & navigation
- [x] Library browsing
- [x] Search functionality
- [x] Book details

### Phase 2: Player & Progress (Week 1-2)
- [ ] Audio player implementation
- [ ] Progress tracking
- [ ] Mini player bar
- [ ] Full player view
- [ ] Playback controls

### Phase 3: User Features (Week 2)
- [ ] Home dashboard
- [ ] My library management
- [ ] Favorites system
- [ ] User settings
- [ ] Continue listening

### Phase 4: Admin Features (Week 3)
- [ ] Admin dashboard
- [ ] Import interface
- [ ] User management
- [ ] Scan controls
- [ ] System stats

### Phase 5: Advanced Features (Week 3-4)
- [ ] Series browsing
- [ ] Author pages
- [ ] Collections
- [ ] Advanced search
- [ ] Recommendations

### Phase 6: Polish & Optimization (Week 4)
- [ ] Animations
- [ ] Performance optimization
- [ ] PWA features
- [ ] Mobile refinements
- [ ] Accessibility audit

## 13. Future Enhancements

### Planned Features (from update.md)
- Metadata matching UI
- Batch operations
- Import queue visualization
- M4B conversion interface
- Cover art management
- File organization tools

### Community Features
- Reviews and ratings
- Public collections
- Social sharing
- Reading challenges
- Discussion threads

### Advanced Integrations
- Goodreads sync
- Last.fm scrobbling
- Discord rich presence
- Smart home integration
- Voice commands

## Summary

This web application plan provides a modern, feature-rich interface for the Flix-Audio backend, with:
- Clean, modern UI inspired by streaming services
- Full audio player with advanced features
- Progressive enhancement from basic to advanced features
- Mobile-first responsive design
- Strong foundation for future expansion

The phased approach ensures core functionality ships quickly while maintaining a path toward the complete vision outlined in update.md.