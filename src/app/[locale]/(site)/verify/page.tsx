import { getTranslations } from "next-intl/server";
import { VerifyForm } from "@/components/home/verify-form";

export async function generateMetadata() {
  const t = await getTranslations("Verify");
  return { title: t("title") };
}

export default async function VerifyPage() {
  const t = await getTranslations("Verify");

  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      <div className="mt-8 rounded-lg border bg-tint p-6">
        <VerifyForm />
      </div>
    </div>
  );
}