"use client";

import { CheckCircle2Icon, DownloadIcon, XCircleIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { CertificateDocument } from "@/components/certificate/document";
import { VerifyForm } from "@/components/home/verify-form";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { certificatePdfUrl, type PublicCertificate, publicVerifyUrl } from "@/lib/api/learning";
import { useApi } from "@/lib/api/use-api";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

// Public check of a certificate by its code. In the static (GitHub Pages) build only certificates
// issued in this browser, and the sample one, can be found.
export function VerifyResult({ code: raw }: { code: string }) {
  const t = useTranslations("Verify");
  const locale = useLocale();
  const format = useFormatter();
  const code = raw.trim().toUpperCase();
  // Read from the address bar without a render-time mismatch: empty on the server, real in the browser.
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const print = useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("print") === "1",
    () => false,
  );

  const res = useApi<PublicCertificate>(code.length <= 40 ? `/api/v1/certificates/${encodeURIComponent(code)}?lang=${locale}` : null);
  const cert = res.data;

  // "Download PDF" on the static site opens this page with ?print=1: print it once it is on screen.
  useEffect(() => {
    if (print && cert) {
      const id = window.setTimeout(() => window.print(), 400);
      return () => window.clearTimeout(id);
    }
  }, [print, cert]);

  if (code.length <= 40 && res.loading) return <Skeleton className="mx-auto mt-10 h-96 max-w-4xl" />;

  if (!cert) {
    return (
      <div className="mx-auto max-w-xl px-4 py-14">
        <div className="flex items-start gap-3">
          <XCircleIcon className="mt-1 size-7 shrink-0 text-destructive" aria-hidden />
          <div>
            <h1 className="text-2xl font-bold">{t("notFoundTitle")}</h1>
            <p className="mt-1 text-muted-foreground">{t("notFoundBody")}</p>
            <p className="mt-2 font-mono text-sm break-all">{code.slice(0, 40)}</p>
          </div>
        </div>
        <div className="mt-8 rounded-lg border bg-tint p-6">
          <VerifyForm />
        </div>
      </div>
    );
  }

  const valid = cert.status === "VALID";
  const issued = new Date(cert.issuedAt);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
      <div
        role="status"
        className={cn(
          "flex items-start gap-3 rounded-lg border p-5",
          valid ? "border-emerald-700/40 bg-emerald-50" : "border-destructive/40 bg-tint",
        )}
      >
        {valid ? (
          <CheckCircle2Icon className="mt-0.5 size-7 shrink-0 text-emerald-700" aria-hidden />
        ) : (
          <XCircleIcon className="mt-0.5 size-7 shrink-0 text-destructive" aria-hidden />
        )}
        <div>
          <h1 className="text-2xl font-bold">
            {valid ? t("valid") : cert.status === "REVOKED" ? t("revoked") : t("superseded")}
          </h1>
          <p className="mt-1 text-muted-foreground">{valid ? t("validBody") : t("invalidBody")}</p>
          {cert.revokedAt ? (
            <p className="mt-1 text-sm">
              {t("revokedOn", { date: format.dateTime(new Date(cert.revokedAt), { dateStyle: "long", timeZone: "UTC" }) })}
              {cert.revokedReason ? ` · ${cert.revokedReason}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      <dl className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Item label={t("holder")} value={cert.recipientName} />
        <Item label={t("course")} value={cert.courseTitle} />
        <Item label={t("issued")} value={format.dateTime(issued, { dateStyle: "long", timeZone: "UTC" })} />
        <Item label={t("id")} value={cert.code} mono />
        {cert.courseHours ? <Item label={t("hours")} value={t("hoursValue", { hours: cert.courseHours })} /> : null}
        {cert.finalScore != null ? <Item label={t("score")} value={`${cert.finalScore}%`} /> : null}
      </dl>

      <div className="mt-8">
        <CertificateDocument
          name={cert.recipientName}
          course={cert.courseTitle}
          hours={cert.courseHours}
          score={cert.finalScore}
          issuedAt={issued}
          code={cert.code}
          verifyUrl={publicVerifyUrl(origin || "https://example.invalid", locale, cert.code)}
          revoked={!valid}
          className="print-area"
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <a href={certificatePdfUrl(cert.code, locale, true)} className={cn(buttonVariants({ size: "lg" }))}>
          <DownloadIcon data-icon="inline-start" />
          {t("download")}
        </a>
      </div>
    </div>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-lg font-semibold break-words", mono && "font-mono text-base")}>{value}</dd>
    </div>
  );
}
