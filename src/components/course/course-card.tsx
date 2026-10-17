import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CourseSummary } from "@/lib/api/catalog";
import { trackName } from "./track-name";

export async function CourseCard({ course }: { course: CourseSummary }) {
  const t = await getTranslations("Course");
  const tracks = await getTranslations("Tracks");
  const languageKey = `language.${course.language}` as never;

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex h-24 items-end bg-tint p-4 text-sm font-semibold text-primary">
        {course.track ? trackName(tracks, course.track) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-sm text-muted-foreground">{t("provider")}</p>
        <h3 lang={course.language} className="text-lg leading-snug font-bold group-hover:text-primary group-hover:underline">
          {course.title}
        </h3>
        <p lang={course.language} className="line-clamp-2 text-sm text-muted-foreground">
          {course.summary}
        </p>
        <p className="mt-auto pt-3 text-sm text-muted-foreground">
          {t(`level.${course.level}`)} · {t.has(languageKey) ? t(languageKey) : course.language}
          {course.estimatedHours ? ` · ${t("hours", { hours: course.estimatedHours })}` : ""}
        </p>
      </div>
    </Link>
  );
}
