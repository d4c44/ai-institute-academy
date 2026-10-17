import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { CertificatePreview } from "./certificate-sample";

export async function Hero() {
  const t = await getTranslations("Home.hero");

  return (
    <section className="border-b bg-tint">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:px-6">
        <div className="flex flex-col items-start gap-5">
          <p className="text-sm font-semibold text-primary">{t("eyebrow")}</p>
          <h1 className="max-w-2xl text-4xl leading-tight font-bold tracking-tight text-balance md:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">{t("subtitle")}</p>
          <Link href="/courses" className={cn(buttonVariants({ size: "lg" }), "mt-2")}>
            {t("browse")}
          </Link>
        </div>

        <CertificatePreview />
      </div>
    </section>
  );
}
