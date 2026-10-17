"use client";

import { useLocale, useTranslations } from "next-intl";
import { notFound } from "next/navigation";
import { Outline } from "@/components/learn/outline";
import { QuizRunner } from "@/components/learn/quiz-runner";
import { useRedirect } from "@/components/learn/use-redirect";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { CourseProgress, QuizDetail } from "@/lib/api/learning";
import { useApi } from "@/lib/api/use-api";

export function QuizView({ slug, quizId }: { slug: string; quizId: string }) {
  const t = useTranslations("Learn");
  const q = useTranslations("Learn.quiz");
  const locale = useLocale();
  const quizRes = useApi<QuizDetail>(`/api/v1/me/quizzes/${encodeURIComponent(quizId)}?lang=${locale}`);
  const courseRes = useApi<CourseProgress>(`/api/v1/me/courses/${encodeURIComponent(slug)}?lang=${locale}`);
  const quiz = quizRes.data;
  const course = courseRes.data;

  const redirecting = useRedirect(
    quizRes.status === 401
      ? { pathname: "/sign-in", query: { next: `/learn/${slug}/quizzes/${quizId}` } }
      : quizRes.status === 403
        ? `/learn/${slug}`
        : quizRes.status === 404 && courseRes.status === 404
          ? `/courses/${slug}`
          : quiz && quiz.courseSlug !== slug
            ? `/learn/${quiz.courseSlug}/quizzes/${quizId}`
            : null,
  );

  if (quizRes.loading || courseRes.loading || redirecting) {
    return <Skeleton className="mx-auto mt-10 h-96 max-w-7xl" />;
  }
  if (!quiz || !course) notFound();

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-6">
      <aside className="hidden rounded-lg border p-4 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100svh-7rem)] lg:self-start lg:overflow-y-auto">
        <Link href={`/learn/${course.slug}`} className="mb-4 block text-sm font-semibold text-primary hover:underline">
          ← {t("backToCourse")}
        </Link>
        <Outline course={course} currentId={quiz.id} />
      </aside>

      <section className="min-w-0 max-w-3xl">
        <p lang={quiz.language} className="text-sm font-semibold text-primary">
          {quiz.moduleTitle ?? quiz.courseTitle}
        </p>
        <h1 lang={quiz.language} className="mt-1 text-3xl leading-tight font-bold tracking-tight">
          {quiz.title}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {q("passMark", { score: quiz.passingScore })}
          {quiz.maxAttempts ? ` · ${q("attempts", { used: quiz.attemptsUsed, max: quiz.maxAttempts })}` : ""}
          {quiz.bestScore != null ? ` · ${q("bestScore", { score: quiz.bestScore })}` : ""}
        </p>
        <div className="mt-8">
          <QuizRunner quiz={quiz} />
        </div>
      </section>
    </div>
  );
}
