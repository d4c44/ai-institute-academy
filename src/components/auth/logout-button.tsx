"use client";

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { signOut } from "./logout";

export function LogoutButton({ className, onDone }: { className?: string; onDone?: () => void }) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut();
        onDone?.();
        router.push("/");
        router.refresh();
      }}
    >
      <LogOutIcon data-icon="inline-start" />
      {t("logOut")}
    </Button>
  );
}
