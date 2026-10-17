"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { apiSend } from "@/lib/api/browser";
import { cn } from "@/lib/utils";

export function EnrollButton({ slug, enrolled }: { slug: string; enrolled: boolean }) {
  const t = useTranslations("Courses.detail");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  if (enrolled) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 font-semibold text-primary">
          <CheckIcon className="size-5" aria-hidden="true" />
          {t("enrolled")}
        </span>
        <Link href={`/learn/${slug}`} className={cn(buttonVariants())}>
          {t("goToCourse")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        size="lg"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(false);
          const res = await apiSend("POST", `/api/v1/courses/${encodeURIComponent(slug)}/enroll`);
          if (res.status === 401) {
            router.push({ pathname: "/sign-in", query: { next: `/courses/${slug}` } });
            return;
          }
          setPending(false);
          if (res.ok) router.refresh();
          else setError(true);
        }}
      >
        {t("enroll")}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t("enrollError")}
        </p>
      ) : null}
    </div>
  );
}
