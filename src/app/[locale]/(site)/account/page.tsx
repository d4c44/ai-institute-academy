import { getTranslations } from "next-intl/server";
import { AccountView } from "@/components/account/account-view";

export async function generateMetadata() {
  const t = await getTranslations("Account");
  return { title: t("title") };
}

// The page itself is static; AccountView loads the signed-in user's data in the browser.
export default async function AccountPage() {
  const t = await getTranslations("Account");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <AccountView />
    </div>
  );
}
