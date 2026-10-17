import { CheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SectionHeading } from "./section-heading";
import { VerifyForm } from "./verify-form";

export async function VerifySection() {
  const t = await getTranslations("Home.certificate");
  const hero = await getTranslations("Home.hero");
  const points = [t("points.name"), t("points.course"), t("points.date"), t("points.id"), t("points.qr")];

  return (
    <section className="mx-auto max-w-7xl px-4 pt-14 lg:px-6">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-12">
        <div>
          <SectionHeading title={t("title")} subtitle={t("body")} />
          <ul className="flex flex-col gap-3">
            {points.map((point) => (
              <li key={point} className="flex gap-3">
                <CheckIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border bg-tint p-6">
          <h3 className="text-lg font-bold">{hero("verifyTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{hero("verifyBody")}</p>
          <VerifyForm className="mt-4" />
        </div>
      </div>
    </section>
  );
}
