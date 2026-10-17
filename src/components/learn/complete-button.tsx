"use client";

import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { apiSend } from "@/lib/api/browser";
import { type CompletionResult, type NextUnit, unitHref } from "@/lib/api/learning";

export function CompleteButton({
  slug,
  lessonId,
  completed,
  next,
}: {
  slug: string;
  lessonId: string;
  completed: boolean;
  next: NextUnit | null;
}) {
  const t = useTranslations("Learn");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function go() {
    if (completed) {
      router.push(unitHref(slug, next));
      return;
    }
    setPending(true);
    setError(false);
    const res = await apiSend<CompletionResult>("POST", `/api/v1/me/lessons/${lessonId}/complete`);
    if (!res.ok || !res.data) {
      setPending(false);
      setError(true);
      return;
    }
    // Going back to the course overview shows the certificate banner when this was the last step.
    router.push(unitHref(slug, res.data.next));
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button size="lg" onClick={go} disabled={pending}>
        {completed ? (
          <>
            {t("next")}
            <ArrowRightIcon data-icon="inline-end" />
          </>
        ) : (
          <>
            <CheckIcon data-icon="inline-start" />
            {next ? t("markCompleteContinue") : t("markCompleteFinish")}
          </>
        )}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t("errors.generic")}
        </p>
      ) : null}
    </div>
  );
}