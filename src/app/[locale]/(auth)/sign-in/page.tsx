import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignInForm } from "@/components/auth/sign-in-form";
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
      <SignInForm next={next} />
    </>
  );
}
