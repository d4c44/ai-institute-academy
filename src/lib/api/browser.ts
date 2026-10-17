// Browser-side calls to the Go API. Same origin (Next.js rewrites /api/v1/* to the API), so the
// HttpOnly session cookie is sent and set automatically.

export type ApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  /** Error code from the API, e.g. "invalid_credentials". */
  error: string | null;
  /** Per-field validation codes, e.g. { password: "too_short" }. */
  fields: Record<string, string>;
};

export async function apiSend<T = unknown>(
  method: "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
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

/** Password policy, mirrored from the API (which stays authoritative). */
export const PASSWORD_MIN_LENGTH = 8;
export function passwordRules(pw: string) {
  return {
    length: [...pw].length >= PASSWORD_MIN_LENGTH,
    symbol: /[^\p{L}\p{N}\s]/u.test(pw),
  };
}
