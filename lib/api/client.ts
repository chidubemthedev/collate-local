import type { ApiResponse, SuccessEnvelope } from "@/types/api";

export class ApiClientError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string>;

  constructor(message: string, code = "api_error", status = 400, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export interface ApiFetchResult<T> {
  data: T;
  meta?: SuccessEnvelope<T>["meta"];
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiFetchResult<T>> {
  const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: options.credentials ?? "include",
  });

  let json: ApiResponse<T>;
  try {
    json = await response.json();
  } catch {
    throw new ApiClientError(
      `Failed to parse response from ${endpoint} (${response.status})`,
      "parse_error",
      response.status
    );
  }

  if (json.status === "error") {
    throw new ApiClientError(
      json.error.message || "An error occurred",
      json.error.code || "unknown_error",
      response.status,
      json.error.fields
    );
  }

  if (!response.ok) {
    throw new ApiClientError(
      `Request failed with status ${response.status}`,
      "http_error",
      response.status
    );
  }

  return {
    data: json.data,
    meta: json.meta,
  };
}

export const apiClient = {
  get: <T>(endpoint: string, queryParams?: Record<string, string | number | boolean | null | undefined>) => {
    let url = endpoint;
    if (queryParams) {
      const search = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          search.set(key, String(val));
        }
      });
      const qs = search.toString();
      if (qs) {
        url += (url.includes("?") ? "&" : "?") + qs;
      }
    }
    return apiFetch<T>(url, { method: "GET" });
  },

  post: <T>(endpoint: string, body?: unknown) => {
    return apiFetch<T>(endpoint, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete: <T>(endpoint: string) => {
    return apiFetch<T>(endpoint, {
      method: "DELETE",
    });
  },
};
