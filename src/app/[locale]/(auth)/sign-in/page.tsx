import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignInForm } from "@/components/auth/sign-in-form";
import { DEMO, DEMO_LOGIN, DEMO_PASSWORD } from "@/demo/server";
import { safeNextPath } from "@/lib/api/auth";

export async function generateMetadata() {
  const t = await getTranslations("Auth.signIn");
  return { title: t("title") };
}

export default function SignInPage({ searchParams }: PageProps<"/[locale]/sign-in">) {
  return (
    <Suspense>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/[locale]/sign-in">, "searchParams">) {
  const t = await getTranslations("Auth.signIn");
  const next = safeNextPath((await searchParams).next);

  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <SignInForm next={next} demo={DEMO ? { login: DEMO_LOGIN, password: DEMO_PASSWORD } : undefined} />
    </>
  );
}
