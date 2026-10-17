import { getTranslations } from "next-intl/server";
import { DEMO, DEMO_LOGIN, DEMO_PASSWORD } from "@/demo/server";

// Shown only in demo mode (npm run dev:demo): there is no real backend behind the site.
export async function DemoBanner() {
  if (!DEMO) return null;
  const t = await getTranslations("Demo");
  return (
    <div role="note" className="border-b bg-foreground px-4 py-2 text-center text-sm text-background">
      {t("banner", { login: DEMO_LOGIN, password: DEMO_PASSWORD })}
    </div>
  );
}