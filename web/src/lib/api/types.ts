export interface PaginationMeta {
  total: number;
  offset: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface User {
  id: string;
  username: string;
  display_name?: string;
  is_admin: boolean;
  created_at: string;
}

export interface LibraryDirectory {
  id: string;
  path: string;
  name: string;
  enabled: boolean;
  book_count?: number;
  last_scanned_at?: string | null;
}

export interface Library {
  id: string;
  name: string;
  display_name: string;
  type: string;
  description?: string | null;
  settings?: Record<string, unknown> | null;
  book_count?: number;
  directories?: LibraryDirectory[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Audiobook {
  id: string;
  library_id?: string | null;
  library_path_id: string;
  metadata_id?: string | null;
  asset_path: string;
  created_at: string;
  updated_at: string;
  metadata?: BookMetadata | null;
  user_data?: UserAudiobookData | null;
  file_count?: number;
  total_duration_sec?: number;
  media_files?: MediaFile[];
}

export interface AudiobookStats {
  total_duration_sec: number;
  file_count: number;
}

export interface BookMetadata {
  id: string;
  title: string;
  subtitle?: string | null;
  author: string;
  narrator?: string | null;
  description?: string | null;
  cover_url?: string | null;
  series_info?: string | null;
  release_date?: string | null;
}

export interface MediaFile {
  id: string;
  audiobook_id: string;
  filename: string;
  duration_sec: number;
  mime_type: string;
}

export interface LibraryEntry {
  audiobook: Audiobook;
  user_data: UserAudiobookData;
}

export interface UserAudiobookData {
  user_id: string;
  audiobook_id: string;
  progress_sec: number;
  is_favorite: boolean;
  last_played_at?: string | null;
}

export type ContinueListeningEntry = LibraryEntry & {
  last_played_at: string | null;
};

export interface DirectoryScanResult {
  directory_id: string;
  directory_path: string;
  books_found: number;
  new_books?: Audiobook[];
  scan_duration: string;
}

export interface LibraryScanResult {
  library_id: string;
  library_name: string;
  directories: DirectoryScanResult[];
  total_books_found: number;
  total_new_books: number;
  scan_duration: string;
}

// Series and Author types
export interface SeriesInfo {
  name: string;
  book_count: number;
  total_duration_sec: number;
  user_progress?: SeriesProgress;
}

export interface SeriesProgress {
  books_started: number;
  books_completed: number;
}

export interface AuthorInfo {
  name: string;
  book_count: number;
  user_stats?: AuthorUserStats;
}

export interface AuthorUserStats {
  books_started: number;
  books_completed: number;
}

// User stats
export interface UserStats {
  streak_days: number;
  total_hours: number;
  books_completed: number;
  books_in_progress: number;
  favorite_count: number;
  listening_time_this_week: number;
  listening_time_this_month: number;
}

// Filter counts for UI chips
export interface FilterCounts {
  all: number;
  not_started: number;
  listening: number;
  completed: number;
  favorites: number;
}

