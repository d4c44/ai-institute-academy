"use client";

import { ChevronDownIcon, LayoutDashboardIcon, LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";
import { initials, signOut } from "./logout";

export function UserMenu({ fullName, login }: { fullName: string; login: string }) {
  const t = useTranslations("Nav");
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("accountMenu")}
        className="flex items-center gap-2 rounded-md p-1 pr-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar>
          <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
            {initials(fullName)}
          </AvatarFallback>
        </Avatar>
        <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
            <span className="text-sm font-semibold text-foreground">{fullName}</span>
            <span className="font-normal">@{login}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account" />}>
          <LayoutDashboardIcon aria-hidden="true" />
          {t("account")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOutIcon aria-hidden="true" />
          {t("logOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
