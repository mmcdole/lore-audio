import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/queries";
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
}: CatalogQueryOptions = {}) =>
  useQuery({
    queryKey: queryKeys.catalog.list(search ?? null, libraryId ?? null),
    queryFn: async () => {
      const trimmedId = libraryId?.trim();
      if (!trimmedId) {
        return { data: [], meta: { offset: 0, limit: 0, total: 0 } } as PaginatedResponse<Audiobook>;
      }

      const path = search
        ? `/libraries/${trimmedId}/books/search`
        : `/libraries/${trimmedId}/books`;

      const response = await apiFetch<{
        data: Audiobook[];
        pagination: { offset: number; limit: number; total: number };
      }>(path, {
        method: "GET",
        searchParams: {
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
    enabled: enabled && Boolean(libraryId?.trim()),
    staleTime: 1000 * 60 * 10,
  });

export const usePersonalLibraryQuery = (libraryId?: string | null) =>
  useQuery({
    queryKey: queryKeys.library.list(libraryId ?? null),
    queryFn: () =>
      apiFetch<LibraryEntry[]>("/library", {
        method: "GET",
        searchParams: libraryId ? { library_id: libraryId } : undefined,
      }),
    enabled: libraryId ? libraryId.trim().length > 0 : true,
    staleTime: 1000 * 60 * 5,
  });

export const useLibraryQuery = usePersonalLibraryQuery;

export const useContinueListeningQuery = (libraryId?: string | null) =>
  useQuery({
    queryKey: queryKeys.library.continueListening(libraryId ?? null),
    queryFn: () =>
      apiFetch<ContinueListeningEntry[]>("/library/continue", {
        method: "GET",
        searchParams: libraryId ? { library_id: libraryId } : undefined,
      }),
    staleTime: 1000 * 60 * 2,
  });

export const useLibrariesQuery = () =>
  useQuery({
    queryKey: queryKeys.libraries.all(),
    queryFn: () =>
      apiFetch<{ data: Library[] }>("/libraries", {
        method: "GET",
      }).then((response) => response.data),
    staleTime: 1000 * 60 * 5,
  });

export const useAdminLibrariesQuery = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: queryKeys.admin.libraries(),
    queryFn: () =>
      apiFetch<{ data: Library[] }>("/admin/libraries", {
        method: "GET",
      }).then((response) => response.data),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60,
  });

export const useUserQuery = () =>
  useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: () =>
      apiFetch<{ data: User }>("/users/me", {
        method: "GET",
      }).then((response) => response.data),
    staleTime: 1000 * 60 * 10,
  });
