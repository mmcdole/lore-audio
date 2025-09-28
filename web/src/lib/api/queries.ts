export const queryKeys = {
  auth: {
    me: () => ["auth", "me"] as const,
  },
  user: {
    profile: () => ["user", "profile"] as const,
  },
  catalog: {
    list: (search?: string | null, libraryId?: string | null) =>
      [
        "catalog",
        "list",
        { search: search ?? null, libraryId: libraryId ?? null },
      ] as const,
    audiobook: (id: string) => ["catalog", "audiobook", id] as const,
  },
  library: {
    list: (libraryId?: string | null) =>
      ["library", "list", { libraryId: libraryId ?? null }] as const,
    continueListening: (libraryId?: string | null) =>
      ["library", "continue", { libraryId: libraryId ?? null }] as const,
  },
  libraries: {
    all: () => ["libraries", "all"] as const,
  },
  admin: {
    libraries: () => ["admin", "libraries"] as const,
  },
};
