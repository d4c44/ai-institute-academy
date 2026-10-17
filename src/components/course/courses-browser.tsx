"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { CourseCard } from "@/components/course/course-card";
import { trackName } from "@/components/course/track-name";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { CourseSummary, Track } from "@/lib/api/catalog";
import { useApi } from "@/lib/api/use-api";

const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const LANGUAGES = ["kk", "ru", "en", "ko"] as const;

export type CourseFilters = { q: string; track: string; level: string; language: string };

/** The filter form and the course grid. Rendered on the server (normal build) or in the browser (static build). */
export function CoursesBrowser({
  filters,
  list,
  tracks,
}: {
  filters: CourseFilters;
  list: { items: CourseSummary[]; total: number } | null;
  tracks: Track[];
}) {
  const t = useTranslations("Courses");
  const course = useTranslations("Course");
  const tracksT = useTranslations("Tracks");
  const hasFilters = Object.values(filters).some(Boolean);

  const selectClass =
    "h-11 w-full rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <>
      {/* Plain GET form: filters live in the URL, no client JavaScript needed. */}
      <form method="get" role="search" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("searchLabel")}
          <input
            name="q"
            defaultValue={filters.q}
            maxLength={100}
            placeholder={t("searchPlaceholder")}
            className="h-11 rounded-lg border border-input bg-background px-3 text-base font-normal outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("track")}
          <select name="track" defaultValue={filters.track} className={selectClass}>
            <option value="">{t("all")}</option>
            {tracks.map((track) => (
              <option key={track.slug} value={track.slug}>
                {trackName(tracksT, track)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("level")}
          <select name="level" defaultValue={filters.level} className={selectClass}>
            <option value="">{t("all")}</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {course(`level.${level}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("language")}
          <select name="language" defaultValue={filters.language} className={selectClass}>
            <option value="">{t("all")}</option>
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {course(`language.${code}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit" size="lg" className="h-11">
            {t("apply")}
          </Button>
          {hasFilters ? (
            <Link href="/courses" className="flex h-11 items-center px-2 text-sm font-semibold text-primary hover:underline">
              {t("reset")}
            </Link>
          ) : null}
        </div>
      </form>

      <p className="mt-8 text-sm text-muted-foreground" role="status">
        {list ? t("results", { count: list.total }) : null}
      </p>

      {!list ? (
        <p className="mt-4 rounded-lg border border-dashed p-10 text-center text-muted-foreground">{t("unavailable")}</p>
      ) : list.items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed p-10 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {list.items.map((item) => (
            <li key={item.slug}>
              <CourseCard course={item} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Static build: there is no server to read the filters from the URL, so the browser does. */
export function StaticCoursesBrowser() {
  const params = useSearchParams();
  const locale = useLocale();
  const filters: CourseFilters = {
    q: (params.get("q") ?? "").slice(0, 100),
    track: params.get("track") ?? "",
    level: params.get("level") ?? "",
    language: params.get("language") ?? "",
  };
  const query = new URLSearchParams({ lang: locale, limit: "60" });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);

  const list = useApi<{ items: CourseSummary[]; total: number }>(`/api/v1/courses?${query}`);
  const tracks = useApi<Track[]>("/api/v1/tracks");

  if (list.loading || tracks.loading) return <Skeleton className="mt-8 h-96 w-full" />;
  return <CoursesBrowser filters={filters} list={list.data} tracks={tracks.data ?? []} />;
}
