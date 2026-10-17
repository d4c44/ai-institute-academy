import { defineRouting } from "next-intl/routing";
import { STATIC } from "@/lib/static";

export const routing = defineRouting({
  locales: ["kk", "ru", "en", "ko"],
  defaultLocale: "kk",
  // Kazakh lives at "/", the others at "/ru", "/en" and "/ko". The static site has no proxy to rewrite
  // "/" to Kazakh, so there every language has its prefix and "/" is a small redirect page.
  localePrefix: STATIC ? "always" : "as-needed",
});

export type Locale = (typeof routing.locales)[number];
