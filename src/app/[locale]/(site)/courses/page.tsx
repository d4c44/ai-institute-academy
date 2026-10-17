import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CourseCard } from "@/components/course/course-card";
import { trackName } from "@/components/course/track-name";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { getCourses, getTracks } from "@/lib/api/catalog";

export async function generateMetadata() {
  const t = await getTranslations("Courses");
  return { title: t("title") };
}

const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const LANGUAGES = ["kk", "ru", "en", "ko"] as const;

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.slice(0, 100) ?? "";
}

export default async function CoursesPage({ searchParams }: PageProps<"/[locale]/courses">) {
  const t = await getTranslations("Courses");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      <Suspense fallback={<Skeleton className="mt-8 h-96 w-full" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/[locale]/courses">, "searchParams">) {
  const params = await searchParams;
  const filters = {
    q: one(params.q),
    track: one(params.track),
    level: one(params.level),
    language: one(params.language),
  };

  const locale = await getLocale();
  const t = await getTranslations("Courses");
  const course = await getTranslations("Course");
  const tracksT = await getTranslations("Tracks");
  const [list, tracks] = await Promise.all([
    getCourses(locale, filters).catch(() => null),
    getTracks().catch(() => []),
  ]);
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
