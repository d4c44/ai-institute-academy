import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Outline } from "@/components/learn/outline";
import { QuizRunner } from "@/components/learn/quiz-runner";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, redirect } from "@/i18n/navigation";
import { authedRequest } from "@/lib/api/auth";
import type { CourseProgress, QuizDetail } from "@/lib/api/learning";

type Props = PageProps<"/[locale]/learn/[slug]/quizzes/[quizId]">;

export default function QuizPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-96 max-w-7xl" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<Props, "params">) {
  const { slug, quizId } = await params;
  const locale = await getLocale();
  const [quizRes, courseRes] = await Promise.all([
    authedRequest<QuizDetail>(`/api/v1/me/quizzes/${encodeURIComponent(quizId)}`),
    authedRequest<CourseProgress>(`/api/v1/me/courses/${encodeURIComponent(slug)}`),
  ]);

  if (quizRes.status === 401) {
    redirect({ href: { pathname: "/sign-in", query: { next: `/learn/${slug}/quizzes/${quizId}` } }, locale });
  }
  if (quizRes.status === 403) redirect({ href: `/learn/${slug}`, locale });
  if (quizRes.status === 404 && courseRes.status === 404) redirect({ href: `/courses/${slug}`, locale });
  if (!quizRes.data || !courseRes.data) notFound();
  const quiz = quizRes.data!;
  const course = courseRes.data!;
  if (quiz.courseSlug !== slug) redirect({ href: `/learn/${quiz.courseSlug}/quizzes/${quizId}`, locale });

  const t = await getTranslations("Learn");
  const q = await getTranslations("Learn.quiz");

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