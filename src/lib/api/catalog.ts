import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { apiGet } from "./client";

// Shapes mirror backend/internal/store/catalog.go.

export type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export type CourseSummary = {
  slug: string;
  title: string;
  summary: string;
  level: CourseLevel;
  /** Language of the text served (the requested one when a translation exists, else the original). */
  language: string;
  /** Every language the course is available in. */
  languages: string[];
  estimatedHours: number | null;
  moduleCount: number;
  learnerCount: number;
  track: { slug: string; name: string } | null;
};

export type Track = {
  slug: string;
  name: string;
  description: string | null;
  courseCount: number;
};

export type Stats = { courses: number; tracks: number; languages: number; learners: number };

// Course text is served in the visitor's language when a translation exists, so the cached reads below
// take the locale as an argument: it becomes part of the cache key.

// Public catalog reads. Cached and tagged "catalog"; the course builder will call
// revalidateTag("catalog") after publishing. Callers run `await connection()` first and sit
// inside <Suspense>, so `next build` never needs the API to be up.

export async function getStats() {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  return apiGet<Stats>("/api/v1/stats");
}

export async function getTracks() {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  return apiGet<Track[]>("/api/v1/tracks");
}

export async function getPopularCourses(locale: string, limit = 8) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const list = await apiGet<{ items: CourseSummary[]; total: number }>(
    `/api/v1/courses?sort=popular&limit=${limit}&lang=${locale}`,
  );
  return list.items;
}

export type CourseFilters = {
  q?: string;
  track?: string;
  level?: string;
  language?: string;
  sort?: "popular" | "new";
};

export async function getCourses(locale: string, filters: CourseFilters = {}) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  params.set("limit", "60");
  params.set("lang", locale);
  return apiGet<{ items: CourseSummary[]; total: number }>(`/api/v1/courses?${params}`);
}

export type CourseDetail = CourseSummary & {
  description: string;
  learningOutcomes: string[];
  prerequisites: string[];
  sequential: boolean;
  hasFinalExam: boolean;
  publishedAt: string | null;
  instructors: { name: string; headline: string | null; bio: string | null; isLead: boolean }[];
  modules: {
    title: string;
    description: string | null;
    hasQuiz: boolean;
    lessons: { title: string; type: "VIDEO" | "TEXT"; durationSec: number | null; isPreview: boolean }[];
  }[];
};

export async function getCourse(slug: string, locale: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  return apiGet<CourseDetail>(`/api/v1/courses/${encodeURIComponent(slug)}?lang=${locale}`);
}
