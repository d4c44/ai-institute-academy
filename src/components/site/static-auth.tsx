"use client";

import { useTranslations } from "next-intl";
import { LogoutButton } from "@/components/auth/logout-button";
import { UserMenu } from "@/components/auth/user-menu";
import { EnrollButton } from "@/components/course/enroll-button";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Me, MyEnrollment } from "@/lib/api/auth";
import { useApi } from "@/lib/api/use-api";
import { cn } from "@/lib/utils";

// The static (GitHub Pages) build has no server to look the visitor up on, so the parts of the page
// that depend on who is signed in are these browser-side twins of the server components
// (AuthNav, MobileAuth, BottomCta's link, the course page's enroll button).

export function StaticAuthNav() {
  const t = useTranslations("Nav");
  const { data: user } = useApi<Me>("/api/v1/me");

  if (user) return <UserMenu fullName={user.fullName} login={user.login} />;

  return (
    <>
      <Link href="/sign-in" className="px-3 text-sm font-semibold text-primary hover:underline">
        {t("signIn")}
      </Link>
      <Link href="/sign-up" className={cn(buttonVariants({ variant: "outline" }))}>
        {t("signUp")}
      </Link>
    </>
  );
}

export function StaticMobileAuth() {
  const t = useTranslations("Nav");
  const { data: user } = useApi<Me>("/api/v1/me");

  if (user) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{user.fullName}</p>
        <Link href="/account" className={cn(buttonVariants({ size: "lg" }))}>
          {t("account")}
        </Link>
        <LogoutButton className="h-12 text-base" />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }))}>
        {t("signUp")}
      </Link>
      <Link href="/sign-in" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
        {t("signIn")}
      </Link>
    </div>
  );
}

export function StaticCtaLink() {
  const t = useTranslations("Home.cta");
  const { data: user } = useApi<Me>("/api/v1/me");

  return (
    <Link
      href={user ? "/courses" : "/sign-up"}
      className={cn(buttonVariants({ size: "lg" }), "bg-white text-primary hover:bg-tint")}
    >
      {user ? t("browse") : t("action")}
    </Link>
  );
}

export function StaticEnroll({ slug }: { slug: string }) {
  const { loading, data } = useApi<MyEnrollment[]>("/api/v1/me/enrollments");
  if (loading) return null;
  return <EnrollButton slug={slug} enrolled={(data ?? []).some((e) => e.slug === slug)} />;
}
