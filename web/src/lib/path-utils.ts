interface FilesystemRoots {
  library: string;
  import: string;
}

let cachedRoots: FilesystemRoots | null = null;

/**
 * Fetch the configured filesystem roots from the backend
 */
export async function getFilesystemRoots(): Promise<FilesystemRoots> {
  if (cachedRoots) {
    return cachedRoots;
  }

  try {
    const response = await fetch('/api/v1/admin/filesystem/roots');
    if (!response.ok) {
      throw new Error(`Failed to fetch filesystem roots: ${response.status}`);
    }
    const data = await response.json();
    cachedRoots = data.data;
    return cachedRoots!;
  } catch (error) {
    console.error('Error fetching filesystem roots:', error);
    // Fallback to hardcoded values if API fails
    const fallback = {
      library: '/Users/drake/Documents/audiobooks',
      import: '/Users/drake/Documents/import'
    };
    cachedRoots = fallback;
    return fallback;
  }
}

/**
 * Convert a full filesystem path to a relative path from the configured root
 */
export async function fullPathToRelative(fullPath: string, rootType: 'library' | 'import'): Promise<string> {
  if (!fullPath) return '';

  const roots = await getFilesystemRoots();
  const rootPath = roots[rootType];

  // If the path starts with the root, return the relative portion
  if (fullPath.startsWith(rootPath)) {
    const relative = fullPath.substring(rootPath.length);
    // Remove leading slash if present
    return relative.startsWith('/') ? relative.substring(1) : relative;
  }

  // If it's already relative or doesn't match expected root, return as-is
  return fullPath;
}

/**
 * Convert a relative path to a full filesystem path using the configured root
 */
export async function relativePathToFull(relativePath: string, rootType: 'library' | 'import'): Promise<string> {
  if (!relativePath) {
    const roots = await getFilesystemRoots();
    return roots[rootType];
  }

  const roots = await getFilesystemRoots();
  const rootPath = roots[rootType];

  // If it's already a full path starting with the root, return as-is
  if (relativePath.startsWith(rootPath)) {
    return relativePath;
  }

  // Combine root and relative path
  return `${rootPath}/${relativePath}`;
}

/**
 * Clear the cached filesystem roots (useful for testing or if roots change)
 */
export function clearRootsCache(): void {
  cachedRoots = null;
}