"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

type Href = string | { pathname: string; query?: Record<string, string> };

/** Client-side redirect for pages that learn about it from an API answer (the user is not signed in, ...). */
export function useRedirect(target: Href | null) {
  const router = useRouter();
  const key = target === null ? "" : JSON.stringify(target);
  useEffect(() => {
    if (key) router.replace(JSON.parse(key) as Href);
  }, [key, router]);
  return target !== null;
}
