"use client";

import { AwardIcon, CheckCircle2Icon, DownloadIcon, XCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { apiSend } from "@/lib/api/browser";
import { certificatePdfUrl, type QuizDetail, type QuizResult, unitHref } from "@/lib/api/learning";
import { cn } from "@/lib/utils";

// Question text may use *emphasis*; nothing else is interpreted.
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/g).map((part, i) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
          <em key={i}>{part.slice(1, -1)}</em>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function QuizRunner({ quiz }: { quiz: QuizDetail }) {
  const t = useTranslations("Learn.quiz");
  const locale = useLocale();
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = quiz.questions.every((q) => (answers[q.id]?.length ?? 0) > 0);
  const attemptsLeft = quiz.maxAttempts == null ? Infinity : quiz.maxAttempts - quiz.attemptsUsed;

  function choose(questionId: string, optionId: string, multiple: boolean) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (!multiple) return { ...prev, [questionId]: [optionId] };
      return {
        ...prev,
        [questionId]: current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId],
      };
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!allAnswered) return;
    setPending(true);
    setError(null);
    const res = await apiSend<QuizResult>("POST", `/api/v1/me/quizzes/${quiz.id}/submit?lang=${locale}`, { answers });
    setPending(false);
    if (res.ok && res.data) {
      setResult(res.data);
      router.refresh(); // sidebar and course progress read fresh state
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setError(res.error === "no_attempts_left" ? "noAttempts" : "generic");
    }
  }

  function retry() {
    setAnswers({});
    setResult(null);
    window.scrollTo({ top: 0 });
  }

  const outcome = new Map(result?.results.map((r) => [r.questionId, r]));
  const canRetry = result && !result.passed && (result.maxAttempts == null || result.attemptsUsed < result.maxAttempts);

  return (
    <div className="flex flex-col gap-8">
      {result ? (
        <section
          role="status"
          className={cn("rounded-lg border p-6", result.passed ? "border-emerald-700/40 bg-emerald-50" : "bg-tint")}
        >
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            {result.passed ? (
              <CheckCircle2Icon className="size-7 text-emerald-700" aria-hidden />
            ) : (
              <XCircleIcon className="size-7 text-primary" aria-hidden />
            )}
            {result.passed ? t("passed") : t("notPassed")}
          </h2>
          <p className="mt-2 text-lg">
            {t("score", { score: result.score })} · {t("correctCount", { correct: result.correctCount, total: result.total })}
          </p>
          <p className="text-muted-foreground">{t("passMark", { score: result.passingScore })}</p>

          {result.passed && result.certificate ? (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border bg-background p-4">
              <AwardIcon className="size-6 text-primary" aria-hidden />
              <div className="mr-auto">
                <p className="font-bold">{t("certificateIssued")}</p>
                <p className="text-sm text-muted-foreground">{result.certificate.code}</p>
              </div>
              <a
                href={certificatePdfUrl(result.certificate.code, locale, true)}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <DownloadIcon data-icon="inline-start" />
                {t("downloadPdf")}
              </a>
              <Link href={`/verify/${result.certificate.code}`} className={cn(buttonVariants())}>
                {t("viewCertificate")}
              </Link>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            {result.passed ? (
              <Link href={unitHref(result.courseSlug, result.next)} className={cn(buttonVariants({ size: "lg" }))}>
                {result.next ? t("continue") : t("backToCourse")}
              </Link>
            ) : null}
            {canRetry ? (
              <Button size="lg" onClick={retry}>
                {t("retry")}
              </Button>
            ) : null}
            {/* When there is nothing after this quiz the primary button already says "course overview". */}
            {!result.passed || result.next ? (
              <Link href={`/learn/${result.courseSlug}`} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                {t("backToCourse")}
              </Link>
            ) : null}
          </div>
          {!result.passed && !canRetry ? <p className="mt-3 text-destructive">{t("noAttempts")}</p> : null}
        </section>
      ) : null}

      <form onSubmit={submit} className="flex flex-col gap-6">
        <ol className="flex flex-col gap-6">
          {quiz.questions.map((q, index) => {
            const multiple = q.type === "MULTIPLE_CHOICE";
            const r = outcome.get(q.id);
            return (
              <li key={q.id}>
                <fieldset
                  disabled={Boolean(result)}
                  className={cn(
                    "rounded-lg border p-5",
                    r && (r.correct ? "border-emerald-700/50" : "border-destructive/50"),
                  )}
                >
                  <legend className="px-1 text-lg font-bold" lang={quiz.language}>
                    {index + 1}. <Inline text={q.prompt} />
                  </legend>
                  <p className="mt-1 text-sm text-muted-foreground">{multiple ? t("selectMany") : t("selectOne")}</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {q.options.map((o) => {
                      const checked = (answers[q.id] ?? []).includes(o.id);
                      return (
                        <label
                          key={o.id}
                          lang={quiz.language}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-base hover:bg-muted has-[:disabled]:cursor-default has-[:disabled]:hover:bg-transparent",
                            checked && "border-primary bg-tint",
                          )}
                        >
                          <input
                            type={multiple ? "checkbox" : "radio"}
                            name={q.id}
                            value={o.id}
                            checked={checked}
                            onChange={() => choose(q.id, o.id, multiple)}
                            className="mt-1 size-4 accent-primary"
                          />
                          <span>{o.text}</span>
                        </label>
                      );
                    })}
                  </div>
                  {r ? (
                    <div className="mt-3 text-sm">
                      <p className={cn("flex items-center gap-1.5 font-bold", r.correct ? "text-emerald-700" : "text-destructive")}>
                        {r.correct ? <CheckCircle2Icon className="size-4" aria-hidden /> : <XCircleIcon className="size-4" aria-hidden />}
                        {r.correct ? t("correct") : t("incorrect")}
                      </p>
                      {r.explanation ? (
                        <p lang={quiz.language} className="mt-1 text-muted-foreground">
                          {r.explanation}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </fieldset>
              </li>
            );
          })}
        </ol>

        {!result ? (
          <div className="flex flex-col items-start gap-2">
            <Button type="submit" size="lg" disabled={pending || !allAnswered || attemptsLeft <= 0}>
              {pending ? t("submitting") : t("submit")}
            </Button>
            {!allAnswered ? <p className="text-sm text-muted-foreground">{t("answerAll")}</p> : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {t(`errors.${error}` as never)}
              </p>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}