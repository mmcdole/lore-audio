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
      const response = await apiFetch<{
        data: Audiobook[];
        pagination: { offset: number; limit: number; total: number };
      }>("/library", {
        method: "GET",
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
    enabled: enabled,
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
      apiFetch<Audiobook[]>("/library/continue", {
        method: "GET",
        searchParams: libraryId ? { library_id: libraryId } : undefined,
      }),
    staleTime: 1000 * 60 * 2,
  });

export const useFavoritesQuery = (libraryId?: string | null) =>
  useQuery({
    queryKey: queryKeys.library.favorites(libraryId ?? null),
    queryFn: async () => {
      const trimmedId = libraryId?.trim();

      const response = await apiFetch<{
        data: Audiobook[];
        pagination: { offset: number; limit: number; total: number };
      }>("/library/favorites", {
        method: "GET",
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
    staleTime: 1000 * 60 * 5,
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
