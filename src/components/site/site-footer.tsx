import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "./logo";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const nav = await getTranslations("Nav");
  const brand = await getTranslations("Brand");

  return (
    <footer className="mt-16 border-t bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-[2fr_1fr_1fr] lg:px-6">
        <div className="flex flex-col gap-3">
          <Logo name={brand("name")} mark={false} />
          <p className="max-w-sm text-sm text-muted-foreground">{brand("university")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t("tagline")}</p>
        </div>
        <FooterColumn title={t("learn")}>
          <Link href="/courses">{nav("courses")}</Link>
        </FooterColumn>
        <FooterColumn title={t("certificates")}>
          <Link href="/verify">{nav("verify")}</Link>
        </FooterColumn>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-5 text-sm text-muted-foreground lg:px-6">© {t("copyright")}</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-muted-foreground [&_a:hover]:text-primary [&_a:hover]:underline">
        {children}
      </div>
    </div>
  );
}
