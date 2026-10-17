import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CoursesBrowser, StaticCoursesBrowser } from "@/components/course/courses-browser";
import { Skeleton } from "@/components/ui/skeleton";
import { getCourses, getTracks } from "@/lib/api/catalog";
import { STATIC } from "@/lib/static";

export async function generateMetadata() {
  const t = await getTranslations("Courses");
  return { title: t("title") };
}

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
        {/* The static build has no request to read the filters from; its browser reads them from the URL. */}
        {STATIC ? <StaticCoursesBrowser /> : <Results searchParams={searchParams} />}
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
  const [list, tracks] = await Promise.all([
    getCourses(locale, filters).catch(() => null),
    getTracks().catch(() => []),
  ]);

  return <CoursesBrowser filters={filters} list={list} tracks={tracks} />;
}
