"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { apiSend } from "@/lib/api/browser";
import { safeNextPath } from "@/lib/api/next-path";
import { Field, inputClass } from "./field";
import { PasswordInput } from "./password-input";

const KNOWN_ERRORS = ["invalid_credentials", "rate_limited", "network"] as const;

export function SignInForm() {
  const t = useTranslations("Auth");
  const next = safeNextPath(useSearchParams().get("next"));
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const res = await apiSend("POST", "/api/v1/auth/login", { login, password });
    if (res.ok) {
      router.push(next ?? "/account");
      router.refresh();
      return;
    }
    setPending(false);
    setError(KNOWN_ERRORS.find((code) => code === res.error) ?? "internal");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-tint px-3 py-2 text-sm text-destructive">
          {t(`errors.${error}` as never)}
        </p>
      ) : null}

      <Field id="signin-login" label={t("loginOrEmailLabel")}>
        <Input
          id="signin-login"
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field id="signin-password" label={t("passwordLabel")}>
        <PasswordInput id="signin-password" autoComplete="current-password" value={password} onChange={setPassword} />
      </Field>

      <Button type="submit" size="lg" disabled={pending || !login || !password}>
        {pending ? t("signIn.submitting") : t("signIn.submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("signIn.noAccount")}{" "}
        <Link
          href={next ? { pathname: "/sign-up", query: { next } } : "/sign-up"}
          className="font-semibold text-primary hover:underline"
        >
          {t("signIn.noAccountAction")}
        </Link>
      </p>
    </form>
  );
}
