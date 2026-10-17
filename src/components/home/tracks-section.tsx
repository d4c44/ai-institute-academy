import { getTranslations } from "next-intl/server";
import { atRequestTime } from "@/lib/runtime";
import { Suspense } from "react";
import { trackName } from "@/components/course/track-name";
import { Unavailable } from "@/components/home/unavailable";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { getTracks } from "@/lib/api/catalog";
import { SectionHeading } from "./section-heading";

export async function TracksSection() {
  const t = await getTranslations("Home.tracks");

  return (
    <section className="mx-auto max-w-7xl px-4 pt-12 lg:px-6">
      <SectionHeading title={t("title")} subtitle={t("subtitle")} />
      <Suspense fallback={<TracksSkeleton />}>
        <TracksGrid />
      </Suspense>
    </section>
  );
}

async function TracksGrid() {
  await atRequestTime();
  const tracks = await getTracks().catch(() => null);
  if (!tracks) return <Unavailable />;
  const t = await getTranslations("Home.tracks");
  const names = await getTranslations("Tracks");

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tracks.map((track) => (
        <li key={track.slug}>
          <Link
            href={{ pathname: "/courses", query: { track: track.slug } }}
            className="flex h-full flex-col gap-1 rounded-lg border p-4 transition-colors hover:border-primary hover:bg-tint focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="font-semibold">{trackName(names, track)}</span>
            <span className="text-sm text-muted-foreground">{t("courseCount", { count: track.courseCount })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function TracksSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border p-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}
