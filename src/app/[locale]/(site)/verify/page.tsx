import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { VerifyByQuery } from "@/components/verify/verify-by-query";

export async function generateMetadata() {
  const t = await getTranslations("Verify");
  return { title: t("title") };
}

// Reads ?code= in the browser, so the page itself stays static.
export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyByQuery />
    </Suspense>
  );
}
