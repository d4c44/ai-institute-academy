import { Suspense } from "react";
import { BottomCta } from "@/components/home/bottom-cta";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { PopularCourses } from "@/components/home/popular-courses";
import { Stats, StatsSkeleton } from "@/components/home/stats";
import { TracksSection } from "@/components/home/tracks-section";
import { VerifySection } from "@/components/home/verify-section";

// Static shell: hero, headings and "how it works" are prerendered; catalog data streams in
// behind skeletons and is served from the "catalog" cache (see lib/api/catalog.ts).
export default function HomePage() {
  return (
    <>
      <Hero />
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>
      <PopularCourses />
      <TracksSection />
      <HowItWorks />
      <VerifySection />
      <BottomCta />
    </>
  );
}
