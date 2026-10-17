import { CheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LocaleSwitcher } from "@/components/site/locale-switcher";
import { Logo } from "@/components/site/logo";
import { Link } from "@/i18n/navigation";

// Full-screen sign-in / sign-up: blue panel on the left half, the form on the right half. Used by
// (auth)/layout.tsx, so the panel and top bar persist while only the form changes between pages.
export async function AuthShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Auth.panel");
  const nav = await getTranslations("Nav");
  const brand = await getTranslations("Brand");
  const points = [t("points.one"), t("points.two"), t("points.three")];

  return (
    <div className="grid min-h-svh flex-1 md:grid-cols-2">
      <aside className="hidden flex-col bg-primary p-12 text-primary-foreground md:flex lg:p-16">
        <p className="font-semibold text-primary-foreground/90">{brand("university")}</p>
        <div className="my-auto max-w-lg">
          <h2 className="text-3xl leading-tight font-bold text-balance lg:text-4xl">{t("headline")}</h2>
          <ul className="mt-8 flex flex-col gap-4 text-lg">
            {points.map((point) => (
              <li key={point} className="flex gap-3 text-primary-foreground/95">
                <CheckIcon className="mt-1 size-5 shrink-0" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex min-h-svh flex-col px-6 py-5 sm:px-10 md:min-h-0">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            aria-label={nav("home")}
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo name={brand("name")} />
          </Link>
          <Suspense fallback={<div className="h-10 w-16" aria-hidden="true" />}>
            <LocaleSwitcher />
          </Suspense>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-10">
          {children}
        </div>
      </div>
    </div>
  );
}
