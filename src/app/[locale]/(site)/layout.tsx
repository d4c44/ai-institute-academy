import { DemoBanner } from "@/components/site/demo-banner";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

// Everything except the full-screen sign-in and sign-up pages (the (auth) group has no chrome).
export default function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <DemoBanner />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
