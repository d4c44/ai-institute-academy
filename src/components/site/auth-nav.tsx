import { getTranslations } from "next-intl/server";
import { UserMenu } from "@/components/auth/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/api/auth";
import { STATIC } from "@/lib/static";
import { cn } from "@/lib/utils";
import { StaticAuthNav } from "./static-auth";

// Reads the session cookie, so it renders at request time inside a <Suspense> boundary.
// If the API is down the visitor simply sees the signed-out links.
export async function AuthNav() {
  if (STATIC) return <StaticAuthNav />;
  const t = await getTranslations("Nav");
  const user = await getCurrentUser().catch(() => null);

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
