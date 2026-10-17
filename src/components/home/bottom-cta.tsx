import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/api/auth";
import { cn } from "@/lib/utils";

export async function BottomCta() {
  const t = await getTranslations("Home.cta");

  return (
    <section className="mx-auto mt-16 max-w-7xl px-4 lg:px-6">
      <div className="flex flex-col items-start gap-5 rounded-lg bg-primary px-6 py-10 text-primary-foreground md:flex-row md:items-center md:justify-between md:px-10">
        <div className="max-w-xl">
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="mt-1 text-primary-foreground/85">{t("body")}</p>
        </div>
        {/* Signed-out visitors are invited to join; signed-in ones to pick a course. */}
        <Suspense fallback={<CtaLink signedIn={false} />}>
          <CtaForVisitor />
        </Suspense>
      </div>
    </section>
  );
}

async function CtaForVisitor() {
  const user = await getCurrentUser().catch(() => null);
  return <CtaLink signedIn={Boolean(user)} />;
}

async function CtaLink({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations("Home.cta");
  return (
    <Link
      href={signedIn ? "/courses" : "/sign-up"}
      className={cn(buttonVariants({ size: "lg" }), "bg-white text-primary hover:bg-tint")}
    >
      {signedIn ? t("browse") : t("action")}
    </Link>
  );
}
