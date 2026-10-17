"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function SearchBox({ className }: { className?: string }) {
  const t = useTranslations("Nav");
  const router = useRouter();

  return (
    <form
      role="search"
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
        router.push(q ? { pathname: "/courses", query: { q } } : "/courses");
      }}
    >
      <label className="relative block">
        <span className="sr-only">{t("searchLabel")}</span>
        <input
          name="q"
          type="search"
          autoComplete="off"
          maxLength={100}
          placeholder={t("searchPlaceholder")}
          className="h-11 w-full rounded-md border border-input bg-background pr-12 pl-4 text-base outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          aria-label={t("searchLabel")}
          className="absolute top-1 right-1 grid size-9 place-items-center rounded-md bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          <SearchIcon className="size-4" aria-hidden="true" />
        </button>
      </label>
    </form>
  );
}
