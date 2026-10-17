import type { Metadata } from "next";
import { Noto_Sans_KR, Source_Sans_3 } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Kazakh letters (ә ғ қ ң ө ұ ү һ) live in the cyrillic-ext range, not plain cyrillic.
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
});

// Source Sans has no Hangul; the browser falls back to this font for Korean text only.
const notoKorean = Noto_Sans_KR({
  variable: "--font-noto-kr",
  subsets: ["latin"],
  preload: false,
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: { default: t("title"), template: `%s · ${t("shortTitle")}` },
    description: t("description"),
  };
}

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${sourceSans.variable} ${notoKorean.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
