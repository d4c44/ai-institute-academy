import { ClockIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CompleteButton } from "@/components/learn/complete-button";
import { Markdown } from "@/components/learn/markdown";
import { Outline } from "@/components/learn/outline";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, redirect } from "@/i18n/navigation";
import { authedRequest } from "@/lib/api/auth";
import type { CourseProgress, LessonDetail } from "@/lib/api/learning";

type Props = PageProps<"/[locale]/learn/[slug]/lessons/[lessonId]">;

export default function LessonPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-96 max-w-7xl" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<Props, "params">) {
  const { slug, lessonId } = await params;
  const locale = await getLocale();
  const [lessonRes, courseRes] = await Promise.all([
    authedRequest<LessonDetail>(`/api/v1/me/lessons/${encodeURIComponent(lessonId)}`),
    authedRequest<CourseProgress>(`/api/v1/me/courses/${encodeURIComponent(slug)}`),
  ]);

  if (lessonRes.status === 401) {
    redirect({ href: { pathname: "/sign-in", query: { next: `/learn/${slug}/lessons/${lessonId}` } }, locale });
  }
  if (lessonRes.status === 403) redirect({ href: `/learn/${slug}`, locale });
  if (lessonRes.status === 404 && courseRes.status === 404) redirect({ href: `/courses/${slug}`, locale });
  if (!lessonRes.data || !courseRes.data) notFound();
  const lesson = lessonRes.data!;
  const course = courseRes.data!;
  if (lesson.courseSlug !== slug) redirect({ href: `/learn/${lesson.courseSlug}/lessons/${lessonId}`, locale });

  const t = await getTranslations("Learn");

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