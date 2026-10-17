import { STATIC } from "@/lib/static";

// Browser-side calls to the API. Same origin (Next.js rewrites /api/v1/* to the Go API), so the
// HttpOnly session cookie is sent and set automatically. In the static (GitHub Pages) build the API
// is answered in the browser by src/static/backend.ts instead.

export type ApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  /** Error code from the API, e.g. "invalid_credentials". */
  error: string | null;
  /** Per-field validation codes, e.g. { password: "too_short" }. */
  fields: Record<string, string>;
};

// Pages that show server data (useApi) reload after any successful change.
const listeners = new Set<() => void>();
export function onApiChange(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

async function transport(method: "GET" | "POST" | "PATCH", path: string, body?: unknown) {
  if (STATIC) {
    const { localFetch } = await import("@/static/backend");
    const res = await localFetch(path, { method, body: body === undefined ? null : JSON.stringify(body) });
    return { ok: res.ok, status: res.status, text: await res.text() };
  }
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

async function request<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await transport(method, path, body);
    const json = res.text ? (JSON.parse(res.text) as Record<string, unknown>) : null;
    if (res.ok && method !== "GET") listeners.forEach((l) => l());
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? (json as T | null) : null,
      error: res.ok ? null : typeof json?.error === "string" ? json.error : "internal",
      fields: res.ok ? {} : ((json?.fields as Record<string, string> | undefined) ?? {}),
    };
  } catch {
    return { ok: false, status: 0, data: null, error: "network", fields: {} };
  }
}

export const apiSend = <T = unknown>(method: "POST" | "PATCH", path: string, body?: unknown) =>
  request<T>(method, path, body);

export const apiRead = <T = unknown>(path: string) => request<T>("GET", path);

/** Password policy, mirrored from the API (which stays authoritative). */
export const PASSWORD_MIN_LENGTH = 8;
export function passwordRules(pw: string) {
  return {
    length: [...pw].length >= PASSWORD_MIN_LENGTH,
    symbol: /[^\p{L}\p{N}\s]/u.test(pw),
  };
}
