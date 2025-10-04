import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/queries";
import { useAuth } from "@/lib/auth/auth-context";
import type {
  Audiobook,
  ContinueListeningEntry,
  Library,
  LibraryEntry,
  PaginatedResponse,
  User,
} from "@/lib/api/types";

type CatalogQueryOptions = {
  search?: string;
  libraryId?: string | null;
  enabled?: boolean;
};

export const useCatalogQuery = ({
  search,
  libraryId,
  enabled = true,
}: CatalogQueryOptions = {}) => {
  const { apiKey } = useAuth();
  return useQuery({
    queryKey: queryKeys.catalog.list(search ?? null, libraryId ?? null),
    queryFn: async () => {
      const response = await apiFetch<{
        data: Audiobook[];
        pagination: { offset: number; limit: number; total: number };
      }>("/library", {
        method: "GET",
        authToken: apiKey ?? undefined,
        searchParams: {
          ...(libraryId ? { library_id: libraryId } : {}),
          ...(search ? { q: search } : {}),
        },
      });

      return {
        data: response.data,
        meta: {
          offset: response.pagination.offset,
          limit: response.pagination.limit,
          total: response.pagination.total,
        },
      } satisfies PaginatedResponse<Audiobook>;
    },
    enabled: enabled && !!apiKey,
    staleTime: 1000 * 60 * 10,
  });
};

export const usePersonalLibraryQuery = (libraryId?: string | null) => {
  const { apiKey } = useAuth();
  return useQuery({
    queryKey: queryKeys.library.list(libraryId ?? null),
    queryFn: () =>
      apiFetch<LibraryEntry[]>("/library", {
        method: "GET",
        authToken: apiKey ?? undefined,
        searchParams: libraryId ? { library_id: libraryId } : undefined,
      }),
    enabled: (libraryId ? libraryId.trim().length > 0 : true) && !!apiKey,
    staleTime: 1000 * 60 * 5,
  });
};

export const useLibraryQuery = usePersonalLibraryQuery;

export const useContinueListeningQuery = (libraryId?: string | null) => {
  const { apiKey } = useAuth();
  return useQuery({
    queryKey: queryKeys.library.continueListening(libraryId ?? null),
    queryFn: () =>
      apiFetch<Audiobook[]>("/library/continue", {
        method: "GET",
        authToken: apiKey ?? undefined,
        searchParams: libraryId ? { library_id: libraryId } : undefined,
      }),
    enabled: !!apiKey,
    staleTime: 1000 * 60 * 2,
  });
};

export const useFavoritesQuery = (libraryId?: string | null) => {
  const { apiKey } = useAuth();
  return useQuery({
    queryKey: queryKeys.library.favorites(libraryId ?? null),
    queryFn: async () => {
      const trimmedId = libraryId?.trim();

      const response = await apiFetch<{
        data: Audiobook[];
        pagination: { offset: number; limit: number; total: number };
      }>("/library/favorites", {
        method: "GET",
        authToken: apiKey ?? undefined,
        searchParams: trimmedId ? { library_id: trimmedId } : undefined,
      });

      return {
        data: response.data,
        meta: {
          offset: response.pagination.offset,
          limit: response.pagination.limit,
          total: response.pagination.total,
        },
      } satisfies PaginatedResponse<Audiobook>;
    },
    enabled: !!apiKey,
    staleTime: 1000 * 60 * 5,
  });
};

export const useLibrariesQuery = () => {
  const { apiKey } = useAuth();
  return useQuery({
    queryKey: queryKeys.libraries.all(),
    queryFn: () =>
      apiFetch<{ data: Library[] }>("/libraries", {
        method: "GET",
        authToken: apiKey ?? undefined,
      }).then((response) => response.data),
    enabled: !!apiKey,
    staleTime: 1000 * 60 * 5,
  });
};

export const useAdminLibrariesQuery = (options?: { enabled?: boolean }) => {
  const { apiKey } = useAuth();
  return useQuery({
    queryKey: queryKeys.admin.libraries(),
    queryFn: () =>
      apiFetch<{ data: Library[] }>("/admin/libraries", {
        method: "GET",
        authToken: apiKey ?? undefined,
      }).then((response) => response.data),
    enabled: (options?.enabled ?? true) && !!apiKey,
    staleTime: 1000 * 60,
  });
};

export const useUserQuery = () => {
  const { apiKey } = useAuth();
  return useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: () =>
      apiFetch<{ data: User }>("/users/me", {
        method: "GET",
        authToken: apiKey ?? undefined,
      }).then((response) => response.data),
    enabled: !!apiKey,
    staleTime: 1000 * 60 * 10,
  });
};

export const useAudiobookQuery = (audiobookId: string) => {
  const { apiKey } = useAuth();
  return useQuery({
    queryKey: queryKeys.library.detail(audiobookId),
    queryFn: () =>
      apiFetch<{ data: Audiobook }>(`/library/${audiobookId}`, {
        method: "GET",
        authToken: apiKey ?? undefined,
      }).then((response) => response.data),
    enabled: !!audiobookId && !!apiKey,
    staleTime: 1000 * 60 * 5,
  });
};
