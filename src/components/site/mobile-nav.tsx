"use client";

import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { NAV_ITEMS } from "./nav-items";
import { SearchBox } from "./search-box";

// `authSlot` is a server-rendered node (account links) supplied by SiteHeader.
export function MobileNav({ authSlot }: { authSlot: React.ReactNode }) {
  const t = useTranslations("Nav");
  const brand = useTranslations("Brand");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label={t("openMenu")} />}
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{brand("name")}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4" onClick={(e) => (e.target as HTMLElement).closest("a") && close()}>
          <SearchBox />
          <nav className="mt-2 flex flex-col">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="border-b py-3 text-base font-semibold hover:text-primary">
                {t(item.label)}
              </Link>
            ))}
          </nav>
          {authSlot}
        </div>
      </SheetContent>
    </Sheet>
  );
}
