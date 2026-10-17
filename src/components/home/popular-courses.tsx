import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { CourseCard } from "@/components/course/course-card";
import { buttonVariants } from "@/components/ui/button";
import { Unavailable } from "@/components/home/unavailable";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { getPopularCourses } from "@/lib/api/catalog";
import { SectionHeading } from "./section-heading";

export async function PopularCourses() {
  const t = await getTranslations("Home.popular");

  return (
    <section className="mx-auto max-w-7xl px-4 pt-14 lg:px-6">
      <SectionHeading
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Link href="/courses" className={buttonVariants({ variant: "outline" })}>
            {t("all")}
          </Link>
        }
      />
      <Suspense fallback={<CoursesSkeleton />}>
        <CoursesGrid />
      </Suspense>
    </section>
  );
}

async function CoursesGrid() {
  await connection();
  const locale = await getLocale();
  const courses = await getPopularCourses(locale, 8).catch(() => null);
  if (!courses) return <Unavailable />;

  if (courses.length === 0) {
    const t = await getTranslations("Home.popular");
    return <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {courses.map((course) => (
        <li key={course.slug}>
          <CourseCard course={course} />
        </li>
      ))}
    </ul>
  );
}

function CoursesSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border">
          <Skeleton className="h-24 rounded-none" />
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
