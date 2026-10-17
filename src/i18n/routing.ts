import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["kk", "ru", "en", "ko"],
  defaultLocale: "kk",
  // Kazakh lives at "/", the others at "/ru", "/en" and "/ko".
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
