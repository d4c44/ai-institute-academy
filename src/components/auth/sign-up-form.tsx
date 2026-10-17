"use client";

import { CheckIcon, CircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { apiSend, passwordRules } from "@/lib/api/browser";
import { cn } from "@/lib/utils";
import { Field, inputClass } from "./field";
import { PasswordInput } from "./password-input";

const YEARS = [1, 2, 3, 4, 5, 6];

export function SignUpForm({ next }: { next?: string }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();

  const [form, setForm] = useState({ fullName: "", login: "", courseYear: "", email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const rules = passwordRules(form.password);
  const passwordOk = rules.length && rules.symbol;

  function fieldMessage(field: string) {
    const code = fieldErrors[field];
    return code ? t(`errors.${field}_${code}` as never) : undefined;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordOk) {
      setFieldErrors({ password: !rules.length ? "too_short" : "needs_symbol" });
      return;
    }
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const res = await apiSend("POST", "/api/v1/auth/register", {
      fullName: form.fullName,
      login: form.login,
      email: form.email,
      courseYear: Number(form.courseYear) || 0,
      password: form.password,
      locale,
    });
    if (res.ok) {
      router.push(next ?? "/account");
      router.refresh();
      return;
    }
    setPending(false);
    if (res.error === "validation") setFieldErrors(res.fields);
    else setFormError(res.error ?? "internal");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {formError ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-tint px-3 py-2 text-sm text-destructive">
          {t(`errors.${formError}` as never)}
        </p>
      ) : null}

      <Field id="signup-name" label={t("fullNameLabel")} error={fieldMessage("fullName")} hint={t("fullNameHint")}>
        <Input
          id="signup-name"
          name="fullName"
          autoComplete="name"
          required
          maxLength={100}
          value={form.fullName}
          onChange={(e) => set("fullName")(e.target.value)}
          aria-invalid={fieldErrors.fullName ? true : undefined}
          aria-describedby={fieldErrors.fullName ? "signup-name-error" : "signup-name-hint"}
          className={inputClass}
        />
      </Field>

      <Field id="signup-login" label={t("loginLabel")} error={fieldMessage("login")} hint={t("loginHint")}>
        <Input
          id="signup-login"
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={32}
          value={form.login}
          onChange={(e) => set("login")(e.target.value)}
          aria-invalid={fieldErrors.login ? true : undefined}
          aria-describedby={fieldErrors.login ? "signup-login-error" : "signup-login-hint"}
          className={inputClass}
        />
      </Field>

      <Field id="signup-year" label={t("courseYearLabel")} error={fieldMessage("courseYear")}>
        <select
          id="signup-year"
          name="courseYear"
          required
          value={form.courseYear}
          onChange={(e) => set("courseYear")(e.target.value)}
          aria-invalid={fieldErrors.courseYear ? true : undefined}
          className="h-11 w-full rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="" disabled>
            {t("courseYearPlaceholder")}
          </option>
          {YEARS.map((year) => (
            <option key={year} value={year}>
              {t("courseYearOption", { year })}
            </option>
          ))}
        </select>
      </Field>

      <Field id="signup-email" label={t("emailLabel")} error={fieldMessage("email")} hint={t("emailHint")}>
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          value={form.email}
          onChange={(e) => set("email")(e.target.value)}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "signup-email-error" : "signup-email-hint"}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <Field id="signup-password" label={t("passwordLabel")} error={fieldMessage("password")}>
          <PasswordInput
            id="signup-password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            invalid={Boolean(fieldErrors.password)}
            describedBy="password-rules"
          />
        </Field>
        <ul id="password-rules" className="flex flex-col gap-1 text-sm">
          <Rule ok={rules.length} touched={form.password.length > 0} label={t("rules.length")} />
          <Rule ok={rules.symbol} touched={form.password.length > 0} label={t("rules.symbol")} />
        </ul>
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("signUp.submitting") : t("signUp.submit")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("signUp.haveAccount")}{" "}
        <Link
          href={next ? { pathname: "/sign-in", query: { next } } : "/sign-in"}
          className="font-semibold text-primary hover:underline"
        >
          {t("signUp.haveAccountAction")}
        </Link>
      </p>
    </form>
  );
}

function Rule({ ok, touched, label }: { ok: boolean; touched: boolean; label: string }) {
  return (
    <li className={cn("flex items-center gap-2", ok ? "text-foreground" : "text-muted-foreground")}>
      {ok ? (
        <CheckIcon className="size-4 text-emerald-700" aria-hidden="true" />
      ) : (
        <CircleIcon className={cn("size-4", touched && "text-destructive")} aria-hidden="true" />
      )}
      {label}
    </li>
  );
}
