"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { verifyHref } from "@/lib/api/learning";

export function VerifyForm({ className }: { className?: string }) {
  const t = useTranslations("Home.hero");
  const router = useRouter();

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
        router.push(code ? verifyHref(code.toUpperCase()) : "/verify");
      }}
    >
      <label className="block text-sm font-semibold" htmlFor="certificate-code">
        {t("verifyLabel")}
      </label>
      <input
        id="certificate-code"
        name="code"
        autoComplete="off"
        spellCheck={false}
        maxLength={40}
        placeholder="AIKAU-26-7K3M-9QX2"
        className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 font-mono text-sm uppercase outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
      />
      <Button type="submit" size="lg" className="mt-3 w-full">
        {t("verifyAction")}
      </Button>
    </form>
  );
}
