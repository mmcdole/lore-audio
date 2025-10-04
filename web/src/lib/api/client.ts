import { API_BASE_URL, API_VERSION } from "@/lib/constants/env";

export type ApiRequestOptions = RequestInit & {
  authToken?: string;
  searchParams?: URLSearchParams | Record<string, string | number | undefined>;
};

export class ApiError extends Error {
  public readonly status: number;
  public readonly causePayload: unknown;

  constructor(message: string, status: number, causePayload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.causePayload = causePayload;
  }
}

const buildUrl = (path: string, searchParams?: ApiRequestOptions["searchParams"]): string => {
  const url = new URL(`${API_VERSION}${path}`, API_BASE_URL);

  if (!searchParams) {
    return url.toString();
  }

  const params =
    searchParams instanceof URLSearchParams
      ? searchParams
      : Object.entries(searchParams).reduce((acc, [key, value]) => {
          if (value === undefined) return acc;
          acc.set(key, String(value));
          return acc;
        }, new URLSearchParams());

  params.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
};

export async function apiFetch<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
  const { authToken, headers, searchParams, ...rest } = options;
  const url = buildUrl(path, searchParams);

  const response = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers
    }
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      // ignore JSON parse errors; fallback to text
      body = await response.text();
    }

    throw new ApiError(response.statusText, response.status, body);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as TResponse;
  }

  return (await response.text()) as TResponse;
}
