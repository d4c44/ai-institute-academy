import "server-only";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { DEMO } from "@/demo/server";
import { ApiError, apiFetch } from "./client";
import type { CourseSummary } from "./catalog";

// Must match backend/internal/httpapi/auth.go.
const SESSION_COOKIE = "ai_session";

export type Me = {
  id: string;
  login: string;
  fullName: string;
  email: string | null;
  courseYear: number | null;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
  locale: string;
  createdAt: string;
};

export type MyEnrollment = CourseSummary & {
  status: "ACTIVE" | "COMPLETED" | "DROPPED";
  enrolledAt: string;
  completedAt: string | null;
  lessonCount: number;
  completedLessons: number;
  progressPercent: number;
};

/** Asks the API for course text in the language of the page being rendered. */
async function withLang(path: string): Promise<string> {
  // The in-memory demo backend reads the clock (session expiry), which Cache Components forbids while prerendering.
  if (DEMO) await connection();
  return `${path}${path.includes("?") ? "&" : "?"}lang=${await getLocale()}`;
}

// Forwards the visitor's session cookie to the API. Per-user data is never cached.
async function authedGet<T>(path: string): Promise<T | null> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;

  const res = await apiFetch(await withLang(path), {
    headers: { Accept: "application/json", Cookie: `${SESSION_COOKIE}=${session}` },
    cache: "no-store",
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new ApiError(res.status, path);
  return (await res.json()) as T;
}

/** Per-user GET that keeps the HTTP status, so pages can redirect on 401 / 403 / 404. */
export async function authedRequest<T>(path: string): Promise<{ status: number; data: T | null }> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return { status: 401, data: null };

  const res = await apiFetch(await withLang(path), {
    headers: { Accept: "application/json", Cookie: `${SESSION_COOKIE}=${session}` },
    cache: "no-store",
  });
  if (!res.ok) return { status: res.status, data: null };
  return { status: res.status, data: (await res.json()) as T };
}

/** The signed-in user, or null. Deduplicated within one render pass. */
export const getCurrentUser = cache(() => authedGet<Me>("/api/v1/me"));

export const getMyEnrollments = cache(async () => (await authedGet<MyEnrollment[]>("/api/v1/me/enrollments")) ?? []);

/** Keeps `next` redirects on-site: a local path made of safe characters, nothing else. */
export function safeNextPath(next: string | string[] | undefined): string | undefined {
  const value = Array.isArray(next) ? next[0] : next;
  return value && /^\/[A-Za-z0-9\-_/]*$/.test(value) && !value.startsWith("//") ? value : undefined;
}
