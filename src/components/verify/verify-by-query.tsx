"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { VerifyForm } from "@/components/home/verify-form";
import { VerifyResult } from "@/components/verify/verify-result";

// /verify on its own asks for a code; /verify?code=... (the static site's way of linking to a
// certificate, since it cannot have a page per code) shows the result.
export function VerifyByQuery() {
  const t = useTranslations("Verify");
  const code = useSearchParams().get("code");

  if (code) return <VerifyResult code={code} />;

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
