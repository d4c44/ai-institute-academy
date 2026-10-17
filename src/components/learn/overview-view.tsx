"use client";

import { AwardIcon, DownloadIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { notFound } from "next/navigation";
import { Outline } from "@/components/learn/outline";
import { useRedirect } from "@/components/learn/use-redirect";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { certificatePdfUrl, type CourseProgress, unitHref, verifyHref } from "@/lib/api/learning";
import { useApi } from "@/lib/api/use-api";
import { cn } from "@/lib/utils";

// A course as its student sees it: progress, the next step, the certificate and the contents.
export function OverviewView({ slug }: { slug: string }) {
  const t = useTranslations("Learn");
  const locale = useLocale();
  const format = useFormatter();
  const res = useApi<CourseProgress>(`/api/v1/me/courses/${encodeURIComponent(slug)}?lang=${locale}`);

  const redirecting = useRedirect(
    res.status === 401
      ? { pathname: "/sign-in", query: { next: `/learn/${slug}` } }
      : res.status === 404
        ? `/courses/${slug}`
        : null,
  );
  if (res.loading || redirecting) return <Skeleton className="mx-auto mt-10 h-96 max-w-4xl" />;
  if (!res.data) notFound();
  const course = res.data;

  const started = course.completedUnits > 0;
  const cert = course.certificate;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
      <p className="text-sm">
        <Link href={`/courses/${course.slug}`} className="font-semibold text-primary hover:underline">
          {t("courseInfo")}
        </Link>
      </p>
      <h1 lang={course.language} className="mt-2 text-3xl font-bold tracking-tight">
        {course.title}
      </h1>

      <div className="mt-6 rounded-lg border p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={course.progressPercent}
              aria-label={t("progressLabel")}
              className="h-2.5 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full bg-primary" style={{ width: `${course.progressPercent}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("progress", { percent: course.progressPercent })} · {t("unitsDone", { done: course.completedUnits, total: course.totalUnits })}
            </p>
          </div>
          {course.next ? (
            <Link href={unitHref(course.slug, course.next)} className={cn(buttonVariants({ size: "lg" }))}>
              {started ? t("continue") : t("start")}
            </Link>
          ) : null}
        </div>
      </div>

      {cert ? (
        <section aria-labelledby="cert" className="mt-6 rounded-lg border border-emerald-700/40 bg-emerald-50 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <AwardIcon className="size-9 text-primary" aria-hidden />
            <div className="mr-auto">
              <h2 id="cert" className="text-lg font-bold">
                {cert.status === "VALID" ? t("certificateReady") : t("certificateRevoked")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {cert.code} · {format.dateTime(new Date(cert.issuedAt), { dateStyle: "long", timeZone: "UTC" })}
              </p>
            </div>
            <a
              href={certificatePdfUrl(cert.code, locale, true)}
              className={cn(buttonVariants({ variant: "outline" }), "bg-background")}
            >
              <DownloadIcon data-icon="inline-start" />
              {t("downloadPdf")}
            </a>
            <Link href={verifyHref(cert.code)} className={cn(buttonVariants())}>
              {t("viewCertificate")}
            </Link>
          </div>
        </section>
      ) : null}

      <h2 className="mt-10 mb-4 text-xl font-bold">{t("contents")}</h2>
      <div className="rounded-lg border p-5">
        <Outline course={course} />
      </div>
    </div>
  );
}
