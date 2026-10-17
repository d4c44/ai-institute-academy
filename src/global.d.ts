import type { Locale } from "@/i18n/routing";
import type messages from "../messages/en.json";

// Type-checks translation keys against messages/en.json (the reference catalog).
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
