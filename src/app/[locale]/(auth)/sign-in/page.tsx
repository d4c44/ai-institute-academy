import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignInForm } from "@/components/auth/sign-in-form";

export async function generateMetadata() {
  const t = await getTranslations("Auth.signIn");
  return { title: t("title") };
}

export default async function SignInPage() {
  const t = await getTranslations("Auth.signIn");

  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      {/* The form reads ?next= itself, in the browser. */}
      <Suspense>
        <SignInForm />
      </Suspense>
    </>
  );
}
