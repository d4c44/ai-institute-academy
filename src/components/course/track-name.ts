import type { getTranslations } from "next-intl/server";

type TracksT = Awaited<ReturnType<typeof getTranslations<"Tracks">>>;

// Track names come from the database in one language; known tracks get a UI translation from
// messages/*.json, and tracks added later through the admin fall back to the stored name.
export function trackName(t: TracksT, track: { slug: string; name: string }) {
  const key = `${track.slug}.name` as never;
  return t.has(key) ? t(key) : track.name;
}

export function trackDescription(t: TracksT, track: { slug: string; description: string | null }) {
  const key = `${track.slug}.description` as never;
  return t.has(key) ? t(key) : (track.description ?? "");
}
