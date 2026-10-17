import { CheckIcon, ClockIcon, FileTextIcon, PlayCircleIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EnrollButton } from "@/components/course/enroll-button";
import { trackName } from "@/components/course/track-name";
import { Skeleton } from "@/components/ui/skeleton";
import { routing, type Locale } from "@/i18n/routing";
import { getMyEnrollments } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getCourse } from "@/lib/api/catalog";

type Props = PageProps<"/[locale]/courses/[slug]">;

async function loadCourse(slug: string, locale: string) {
  try {
    return await getCourse(slug, locale);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props) {
  const { slug, locale } = await params;
  try {
    return { title: (await getCourse(slug, locale)).title };
  } catch {
    return {};
  }
}

export default function CoursePage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-96 max-w-7xl" />}>
      <CourseContent params={params} />
    </Suspense>
  );
}

function minutes(sec: number | null) {
  return sec ? Math.max(1, Math.round(sec / 60)) : null;
}

async function CourseContent({ params }: Pick<Props, "params">) {
  const { slug, locale } = await params;
  const course = await loadCourse(slug, locale);
  const t = await getTranslations("Courses.detail");
  const c = await getTranslations("Course");
  const tracks = await getTranslations("Tracks");
  const languageNames = [...course.languages]
    .sort((x, y) => routing.locales.indexOf(x as Locale) - routing.locales.indexOf(y as Locale))
    .map((code) => (c.has(`language.${code}` as never) ? c(`language.${code}` as never) : code))
    .join(", ");

  const lessonCount = course.modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <>
      <section className="border-b bg-tint">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
          {course.track ? (
            <p className="text-sm font-semibold text-primary">{trackName(tracks, course.track)}</p>
          ) : null}
          <h1 lang={course.language} className="mt-1 max-w-3xl text-3xl leading-tight font-bold tracking-tight md:text-4xl">
            {course.title}
          </h1>
          <p lang={course.language} className="mt-3 max-w-3xl text-lg text-muted-foreground">
            {course.summary}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {c(`level.${course.level}`)} · {languageNames}
            {course.estimatedHours ? ` · ${c("hours", { hours: course.estimatedHours })}` : ""}
          </p>
          <div className="mt-6">
            <Suspense fallback={<Skeleton className="h-12 w-40" />}>
              <EnrollAction slug={course.slug} />
            </Suspense>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-6">
        <div className="flex min-w-0 flex-col gap-10">
          <section aria-labelledby="about">
            <h2 id="about" className="text-xl font-bold">
              {t("about")}
            </h2>
            <p lang={course.language} className="mt-3 whitespace-pre-line text-foreground/90">
              {course.description}
            </p>
          </section>

          {course.learningOutcomes.length > 0 ? (
            <section aria-labelledby="outcomes" className="rounded-lg border p-6">
              <h2 id="outcomes" className="text-xl font-bold">
                {t("outcomes")}
              </h2>
              <ul lang={course.language} className="mt-4 grid gap-3 sm:grid-cols-2">
                {course.learningOutcomes.map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="syllabus">
            <h2 id="syllabus" className="text-xl font-bold">
              {t("syllabus")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("modulesAndLessons", { modules: course.modules.length, lessons: lessonCount })}
            </p>
            <div className="mt-4 divide-y rounded-lg border">
              {course.modules.map((m, index) => (
                <details key={m.title} className="group" open={index === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 font-semibold marker:hidden hover:bg-muted">
                    <span lang={course.language}>
                      <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                      {m.title}
                    </span>
                    <span className="shrink-0 text-sm font-normal text-muted-foreground">
                      {t("lessonsCount", { count: m.lessons.length })}
                    </span>
                  </summary>
                  {m.description || m.lessons.length > 0 ? (
                    <div className="border-t bg-muted/50 px-4 py-3">
                      {m.description ? (
                        <p lang={course.language} className="mb-2 text-sm text-muted-foreground">
                          {m.description}
                        </p>
                      ) : null}
                      <ul className="flex flex-col">
                        {m.lessons.map((lesson) => (
                          <li key={lesson.title} className="flex items-center gap-3 py-1.5 text-sm">
                            {lesson.type === "VIDEO" ? (
                              <PlayCircleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            ) : (
                              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            )}
                            <span lang={course.language} className="flex-1">
                              {lesson.title}
                            </span>
                            {lesson.durationSec ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <ClockIcon className="size-3.5" aria-hidden="true" />
                                {t("minutes", { count: minutes(lesson.durationSec) ?? 0 })}
                              </span>
                            ) : null}
                          </li>
                        ))}
                        {m.hasQuiz ? <li className="py-1.5 text-sm font-semibold text-primary">{t("moduleQuiz")}</li> : null}
                      </ul>
                    </div>
                  ) : null}
                </details>
              ))}
              {course.hasFinalExam ? (
                <p className="p-4 font-semibold text-primary">{t("finalExam")}</p>
              ) : null}
            </div>
          </section>

          {course.prerequisites.length > 0 ? (
            <section aria-labelledby="prereq">
              <h2 id="prereq" className="text-xl font-bold">
                {t("prerequisites")}
              </h2>
              <ul lang={course.language} className="mt-3 list-disc pl-5 text-foreground/90">
                {course.prerequisites.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          {course.instructors.length > 0 ? (
            <section aria-labelledby="instructors" className="rounded-lg border p-5">
              <h2 id="instructors" className="font-bold">
                {t("instructors")}
              </h2>
              <ul className="mt-3 flex flex-col gap-4">
                {course.instructors.map((person) => (
                  <li key={person.name}>
                    <p className="font-semibold">{person.name}</p>
                    {person.headline ? <p className="text-sm text-muted-foreground">{person.headline}</p> : null}
                    {person.bio ? <p className="mt-1 text-sm">{person.bio}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}

async function EnrollAction({ slug }: { slug: string }) {
  const enrollments = await getMyEnrollments().catch(() => []);
  return <EnrollButton slug={slug} enrolled={enrollments.some((e) => e.slug === slug)} />;
}
