import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { safeNextPath } from "@/lib/api/auth";

export async function generateMetadata() {
  const t = await getTranslations("Auth.signUp");
  return { title: t("title") };
}

export default function SignUpPage({ searchParams }: PageProps<"/[locale]/sign-up">) {
  return (
    <Suspense>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/[locale]/sign-up">, "searchParams">) {
  const t = await getTranslations("Auth.signUp");
  const next = safeNextPath((await searchParams).next);

  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <SignUpForm next={next} />
    </>
  );
}
