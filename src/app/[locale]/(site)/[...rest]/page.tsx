import { notFound } from "next/navigation";

// Always a 404, never a real navigation target: skip Cache Components' instant-navigation check.
export const instant = false;

// Unknown paths under a locale (e.g. /ru/nope) render the localized [locale]/not-found.tsx
// instead of falling through to the unlocalized global 404.
export default function CatchAllPage() {
  notFound();
}
