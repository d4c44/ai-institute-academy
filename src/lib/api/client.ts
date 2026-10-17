import "server-only";

// Base URL of the Go API as seen from the Next.js server (Docker: http://api:8080).
export const API_URL = process.env.API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    path: string,
  ) {
    super(`API ${path} responded ${status}`);
  }
}

/** Every server-side call to the Go API goes through here. */
export function apiFetch(path: string, init: { headers?: HeadersInit; cache?: RequestCache } = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, init);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new ApiError(res.status, path);
  return (await res.json()) as T;
}
