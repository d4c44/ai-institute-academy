import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CertificateDocument } from "@/components/certificate/document";
import { Skeleton } from "@/components/ui/skeleton";
import { publicVerifyUrl } from "@/lib/api/learning";
import { atRequestTime } from "@/lib/runtime";
import { STATIC } from "@/lib/static";

const SAMPLE_CODE = "AIKAU-26-7K3M-9QX2";
const SAMPLE_DATE = new Date(Date.UTC(2026, 9, 14));

// The sample certificate on the home page. Its QR points at /verify/<sample code>, which shows the
// "not found" state: it is an illustration, not an issued certificate.
export function CertificatePreview() {
  return (
    <Suspense fallback={<Skeleton className="aspect-[1.414/1] w-full" />}>
      <SampleCertificate />
    </Suspense>
  );
}

async function SampleCertificate() {
  // The QR encodes the site address: APP_URL, which is only known at runtime (the static build
  // knows it when it is built, from NEXT_PUBLIC_SITE_URL).
  await atRequestTime();
  const t = await getTranslations("Certificate");
  const locale = await getLocale();
  const base = STATIC ? (process.env.NEXT_PUBLIC_SITE_URL ?? "") : (process.env.APP_URL ?? "http://localhost:3000");

  return (
    <CertificateDocument
      sample
      name={t("name")}
      course={t("course")}
      hours={72}
      score={92}
      issuedAt={SAMPLE_DATE}
      code={SAMPLE_CODE}
      verifyUrl={publicVerifyUrl(base, locale, SAMPLE_CODE)}
    />
  );
}