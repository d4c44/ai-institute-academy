"use client";

import { ClockIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { notFound } from "next/navigation";
import { CompleteButton } from "@/components/learn/complete-button";
import { Markdown } from "@/components/learn/markdown";
import { Outline } from "@/components/learn/outline";
import { useRedirect } from "@/components/learn/use-redirect";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { CourseProgress, LessonDetail } from "@/lib/api/learning";
import { useApi } from "@/lib/api/use-api";

export function LessonView({ slug, lessonId }: { slug: string; lessonId: string }) {
  const t = useTranslations("Learn");
  const locale = useLocale();
  const lessonRes = useApi<LessonDetail>(`/api/v1/me/lessons/${encodeURIComponent(lessonId)}?lang=${locale}`);
  const courseRes = useApi<CourseProgress>(`/api/v1/me/courses/${encodeURIComponent(slug)}?lang=${locale}`);
  const lesson = lessonRes.data;
  const course = courseRes.data;

  const redirecting = useRedirect(
    lessonRes.status === 401
      ? { pathname: "/sign-in", query: { next: `/learn/${slug}/lessons/${lessonId}` } }
      : lessonRes.status === 403
        ? `/learn/${slug}`
        : lessonRes.status === 404 && courseRes.status === 404
          ? `/courses/${slug}`
          : lesson && lesson.courseSlug !== slug
            ? `/learn/${lesson.courseSlug}/lessons/${lessonId}`
            : null,
  );

  if (lessonRes.loading || courseRes.loading || redirecting) {
    return <Skeleton className="mx-auto mt-10 h-96 max-w-7xl" />;
  }
  if (!lesson || !course) notFound();

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-6">
      <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100svh-7rem)] lg:self-start lg:overflow-y-auto">
        <details className="rounded-lg border lg:hidden">
          <summary className="cursor-pointer list-none p-4 font-bold marker:hidden">{t("contents")}</summary>
          <div className="border-t p-4">
            <Outline course={course} currentId={lesson.id} />
          </div>
        </details>
        <div className="hidden rounded-lg border p-4 lg:block">
          <Link href={`/learn/${course.slug}`} className="mb-4 block text-sm font-semibold text-primary hover:underline">
            ← {t("backToCourse")}
          </Link>
          <Outline course={course} currentId={lesson.id} />
        </div>
      </aside>

      <article className="min-w-0 max-w-3xl">
        <p lang={lesson.language} className="text-sm font-semibold text-primary">
          {lesson.moduleTitle}
        </p>
        <h1 lang={lesson.language} className="mt-1 text-3xl leading-tight font-bold tracking-tight">
          {lesson.title}
        </h1>
        {lesson.durationSec ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <ClockIcon className="size-4" aria-hidden />
            {t("minutes", { count: Math.max(1, Math.round(lesson.durationSec / 60)) })}
          </p>
        ) : null}

        {lesson.videoUrl ? (
          <video src={lesson.videoUrl} controls preload="metadata" className="mt-6 w-full rounded-lg border bg-black" />
        ) : null}

        {lesson.content ? (
          <div className="mt-8">
            <Markdown lang={lesson.language}>{lesson.content}</Markdown>
          </div>
        ) : null}

        <div className="mt-10 border-t pt-6">
          <CompleteButton slug={course.slug} lessonId={lesson.id} completed={lesson.completed} next={lesson.next} />
        </div>
      </article>
    </div>
  );
}
