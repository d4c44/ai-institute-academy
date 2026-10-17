import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CertificateDocument } from "@/components/certificate/document";
import { Skeleton } from "@/components/ui/skeleton";

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
  await connection(); // the QR encodes APP_URL, which is only known at runtime
  const t = await getTranslations("Certificate");
  const base = process.env.APP_URL ?? "http://localhost:3000";

  return (
    <CertificateDocument
      sample
      name={t("name")}
      course={t("course")}
      hours={30}
      score={92}
      issuedAt={SAMPLE_DATE}
      code={SAMPLE_CODE}
      verifyUrl={`${base}/verify/${SAMPLE_CODE}`}
    />
  );
}