import { getTranslations } from "next-intl/server";
import { LogoutButton } from "@/components/auth/logout-button";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/api/auth";
import { cn } from "@/lib/utils";

// Account links inside the mobile menu sheet (server-rendered, passed to the client MobileNav).
export async function MobileAuth() {
  const t = await getTranslations("Nav");
  const user = await getCurrentUser().catch(() => null);

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
