import { getTranslations } from "next-intl/server";

// Shown in place of catalog data when the API can't be reached; the rest of the page still works.
export async function Unavailable() {
  const t = await getTranslations("Home");
  return (
    <p role="status" className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
      {t("unavailable")}
    </p>
  );
}
