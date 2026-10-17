import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignUpForm } from "@/components/auth/sign-up-form";

export async function generateMetadata() {
  const t = await getTranslations("Auth.signUp");
  return { title: t("title") };
}

export default async function SignUpPage() {
  const t = await getTranslations("Auth.signUp");

  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      {/* The form reads ?next= itself, in the browser. */}
      <Suspense>
        <SignUpForm />
      </Suspense>
    </>
  );
}
