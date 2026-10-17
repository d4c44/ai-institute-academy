import { AwardIcon, DownloadIcon } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Outline } from "@/components/learn/outline";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, redirect } from "@/i18n/navigation";
import { authedRequest } from "@/lib/api/auth";
import { certificatePdfUrl, type CourseProgress, unitHref } from "@/lib/api/learning";
import { cn } from "@/lib/utils";

type Props = PageProps<"/[locale]/learn/[slug]">;

export default function LearnPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-96 max-w-4xl" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const locale = await getLocale();
  const res = await authedRequest<CourseProgress>(`/api/v1/me/courses/${encodeURIComponent(slug)}`);
  if (res.status === 401) redirect({ href: { pathname: "/sign-in", query: { next: `/learn/${slug}` } }, locale });
  if (res.status === 404) redirect({ href: `/courses/${slug}`, locale });
  if (!res.data) notFound();
  const course = res.data!;

  const t = await getTranslations("Learn");
  const format = await getFormatter();
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
            <Link href={`/verify/${cert.code}`} className={cn(buttonVariants())}>
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