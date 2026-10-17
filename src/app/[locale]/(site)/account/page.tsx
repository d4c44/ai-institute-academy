import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { AwardIcon, DownloadIcon } from "lucide-react";
import { Suspense } from "react";
import { ProfileCard } from "@/components/account/profile-card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, redirect } from "@/i18n/navigation";
import { authedRequest, getCurrentUser, getMyEnrollments } from "@/lib/api/auth";
import { certificatePdfUrl, type OwnCertificate } from "@/lib/api/learning";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const t = await getTranslations("Account");
  return { title: t("title") };
}

export default async function AccountPage() {
  const t = await getTranslations("Account");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <Suspense fallback={<AccountSkeleton />}>
        <AccountContent />
      </Suspense>
    </div>
  );
}

async function AccountContent() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect({ href: { pathname: "/sign-in", query: { next: "/account" } }, locale });
  const me = user!;

  const t = await getTranslations("Account");
  const format = await getFormatter();
  const memberSince = format.dateTime(new Date(me.createdAt), { dateStyle: "long", timeZone: "UTC" });

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <ProfileCard
        profile={{ fullName: me.fullName, login: me.login, email: me.email, courseYear: me.courseYear }}
        memberSince={memberSince}
      />
      <section aria-labelledby="courses-heading">
        <h2 id="courses-heading" className="text-xl font-bold">
          {t("myCourses")}
        </h2>
        <Suspense fallback={<Skeleton className="mt-4 h-32 w-full" />}>
          <MyCourses />
        </Suspense>

        <h2 id="certificates-heading" className="mt-10 text-xl font-bold">
          {t("certificates")}
        </h2>
        <Suspense fallback={<Skeleton className="mt-4 h-24 w-full" />}>
          <MyCertificates />
        </Suspense>
      </section>
    </div>
  );
}

async function MyCourses() {
  const t = await getTranslations("Account");
  const course = await getTranslations("Course");
  const enrollments = await getMyEnrollments();

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

async function MyCertificates() {
  const t = await getTranslations("Account");
  const locale = await getLocale();
  const format = await getFormatter();
  const res = await authedRequest<OwnCertificate[]>("/api/v1/me/certificates");
  const items = res.data ?? [];

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
          <a href={certificatePdfUrl(c.code, locale, true)} className={cn(buttonVariants({ variant: "outline" }))}>
            <DownloadIcon data-icon="inline-start" />
            {t("downloadPdf")}
          </a>
          <Link href={`/verify/${c.code}`} className={cn(buttonVariants({ variant: "ghost" }))}>
            {t("verifyPage")}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AccountSkeleton() {  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
