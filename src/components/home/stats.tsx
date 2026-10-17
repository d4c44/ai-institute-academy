import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Skeleton } from "@/components/ui/skeleton";
import { getStats } from "@/lib/api/catalog";

export async function Stats() {
  await connection();
  const stats = await getStats().catch(() => null);
  if (!stats) return null;
  const t = await getTranslations("Home.stats");

  const items = [
    { value: stats.courses, label: t("courses", { count: stats.courses }) },
    { value: stats.tracks, label: t("tracks", { count: stats.tracks }) },
    { value: stats.languages, label: t("languages", { count: stats.languages }) },
    { value: stats.learners, label: t("learners", { count: stats.learners }) },
  ];

  return (
    <StatsShell>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 px-4 py-5 lg:px-6">
          <dd className="text-2xl font-bold tabular-nums">{item.value}</dd>
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
        </div>
      ))}
    </StatsShell>
  );
}

export function StatsSkeleton() {
  return (
    <StatsShell>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-2 px-4 py-5 lg:px-6">
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </StatsShell>
  );
}

function StatsShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="border-b">
      <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-x lg:grid-cols-4 [&>div:nth-child(n+3)]:border-t lg:[&>div:nth-child(n+3)]:border-t-0">
        {children}
      </dl>
    </section>
  );
}
