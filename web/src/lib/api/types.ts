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
  metadata_id?: string | null;
  asset_path: string;
  created_at: string;
  updated_at: string;
  metadata?: BookMetadata | null;
  stats?: AudiobookStats;
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
