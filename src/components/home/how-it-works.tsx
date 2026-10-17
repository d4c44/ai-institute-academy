import { getTranslations } from "next-intl/server";
import { SectionHeading } from "./section-heading";

const STEPS = ["enroll", "learn", "certify"] as const;

export async function HowItWorks() {
  const t = await getTranslations("Home.how");

  return (
    <section className="mx-auto max-w-7xl px-4 pt-14 lg:px-6">
      <SectionHeading title={t("title")} subtitle={t("subtitle")} />
      <ol className="grid gap-8 border-t pt-8 md:grid-cols-3">
        {STEPS.map((key, index) => (
          <li key={key} className="flex gap-4">
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-tint text-sm font-bold text-primary"
            >
              {index + 1}
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="font-bold">{t(`${key}.title`)}</h3>
              <p className="text-muted-foreground">{t(`${key}.body`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
