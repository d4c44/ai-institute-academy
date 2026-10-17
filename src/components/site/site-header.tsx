import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { AuthNav } from "./auth-nav";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { MobileAuth } from "./mobile-auth";
import { MobileNav } from "./mobile-nav";
import { NAV_ITEMS } from "./nav-items";
import { SearchBox } from "./search-box";

export async function SiteHeader() {
  const t = await getTranslations("Nav");
  const brand = await getTranslations("Brand");

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-6 px-4 lg:px-6">
        <Link href="/" aria-label={t("home")} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo name={brand("name")} />
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-semibold text-foreground hover:text-primary">
              {t(item.label)}
            </Link>
          ))}
        </nav>

        <SearchBox className="hidden max-w-xl flex-1 md:block" />

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          {/* Reads the current URL (runtime data on pages with dynamic segments). */}
          <Suspense fallback={<div className="h-10 w-16" aria-hidden="true" />}>
            <LocaleSwitcher />
          </Suspense>
          {/* Signed-in state is per request; the placeholder keeps the header from jumping. */}
          <div className="hidden items-center gap-1 md:flex">
            <Suspense fallback={<div className="h-10 w-44" aria-hidden="true" />}>
              <AuthNav />
            </Suspense>
          </div>
          <MobileNav
            authSlot={
              <Suspense fallback={null}>
                <MobileAuth />
              </Suspense>
            }
          />
        </div>
      </div>
    </header>
  );
}
