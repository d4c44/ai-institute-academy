"use client";

import { AwardIcon, DownloadIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { ProfileCard } from "@/components/account/profile-card";
import { useRedirect } from "@/components/learn/use-redirect";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Me, MyEnrollment } from "@/lib/api/auth";
import { certificatePdfUrl, type OwnCertificate, verifyHref } from "@/lib/api/learning";
import { useApi } from "@/lib/api/use-api";
import { cn } from "@/lib/utils";

// The signed-in user's page: profile, courses with progress, certificates. Loaded in the browser.
export function AccountView() {
  const t = useTranslations("Account");
  const locale = useLocale();
  const format = useFormatter();
  const me = useApi<Me>("/api/v1/me");
  const redirecting = useRedirect(me.status === 401 ? { pathname: "/sign-in", query: { next: "/account" } } : null);

  if (!me.data || redirecting) return <AccountSkeleton />;
  const user = me.data;
  const memberSince = format.dateTime(new Date(user.createdAt), { dateStyle: "long", timeZone: "UTC" });

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <ProfileCard
        profile={{ fullName: user.fullName, login: user.login, email: user.email, courseYear: user.courseYear }}
        memberSince={memberSince}
      />
      <section aria-labelledby="courses-heading">
        <h2 id="courses-heading" className="text-xl font-bold">
          {t("myCourses")}
        </h2>
        <MyCourses lang={locale} />

        <h2 id="certificates-heading" className="mt-10 text-xl font-bold">
          {t("certificates")}
        </h2>
        <MyCertificates lang={locale} />
      </section>
    </div>
  );
}

function MyCourses({ lang }: { lang: string }) {
  const t = useTranslations("Account");
  const course = useTranslations("Course");
  const { data: enrollments } = useApi<MyEnrollment[]>(`/api/v1/me/enrollments?lang=${lang}`);

  if (!enrollments) return <Skeleton className="mt-4 h-32 w-full" />;

  if (enrollments.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-start gap-4 rounded-lg border border-dashed p-8">
        <p className="text-muted-foreground">{t("noCourses")}</p>
        <Link href="/courses" className={cn(buttonVariants())}>
          {t("browse")}
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-4 flex flex-col gap-4">
      {enrollments.map((e) => (
        <li key={e.slug} className="rounded-lg border p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 lang={e.language} className="text-lg font-bold">
                <Link href={`/learn/${e.slug}`} className="hover:text-primary hover:underline">
                  {e.title}
                </Link>
              </h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {course(`level.${e.level}`)}
                {e.estimatedHours ? ` · ${course("hours", { hours: e.estimatedHours })}` : ""}
              </p>
            </div>
            {e.status === "COMPLETED" ? (
              <span className="rounded-full bg-tint px-3 py-1 text-sm font-semibold text-primary">{t("completed")}</span>
            ) : null}
          </div>

          <div className="mt-4">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={e.progressPercent}
              aria-label={t("progressLabel", { title: e.title })}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full bg-primary" style={{ width: `${e.progressPercent}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("progress", { percent: e.progressPercent })} · {t("lessonsDone", { done: e.completedLessons, total: e.lessonCount })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function MyCertificates({ lang }: { lang: string }) {
  const t = useTranslations("Account");
  const format = useFormatter();
  const { data: items } = useApi<OwnCertificate[]>(`/api/v1/me/certificates?lang=${lang}`);

  if (!items) return <Skeleton className="mt-4 h-24 w-full" />;

  if (items.length === 0) {
    return <p className="mt-4 rounded-lg border border-dashed p-6 text-muted-foreground">{t("noCertificates")}</p>;
  }

  return (
    <ul className="mt-4 flex flex-col gap-3">
      {items.map((c) => (
        <li key={c.code} className="flex flex-wrap items-center gap-4 rounded-lg border p-5">
          <AwardIcon className="size-8 shrink-0 text-primary" aria-hidden="true" />
          <div className="mr-auto min-w-0">
            <p lang={c.locale} className="font-bold">
              {c.courseTitle}
            </p>
            <p className="text-sm text-muted-foreground">
              {format.dateTime(new Date(c.issuedAt), { dateStyle: "long", timeZone: "UTC" })} · {c.code}
              {c.status !== "VALID" ? ` · ${t("revoked")}` : ""}
            </p>
          </div>
          <a href={certificatePdfUrl(c.code, lang, true)} className={cn(buttonVariants({ variant: "outline" }))}>
            <DownloadIcon data-icon="inline-start" />
            {t("downloadPdf")}
          </a>
          <Link href={verifyHref(c.code)} className={cn(buttonVariants({ variant: "ghost" }))}>
            {t("verifyPage")}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AccountSkeleton() {
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
