"use client";

import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, inputClass } from "@/components/auth/field";
import { LogoutButton } from "@/components/auth/logout-button";
import { initials } from "@/components/auth/logout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { apiSend } from "@/lib/api/browser";

type Profile = {
  fullName: string;
  login: string;
  email: string | null;
  courseYear: number | null;
};

const YEARS = [1, 2, 3, 4, 5, 6];

export function ProfileCard({ profile, memberSince }: { profile: Profile; memberSince: string }) {
  const t = useTranslations("Account");
  const auth = useTranslations("Auth");
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    fullName: profile.fullName,
    courseYear: profile.courseYear ? String(profile.courseYear) : "",
    email: profile.email ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(null);

    const res = await apiSend("PATCH", "/api/v1/me", {
      fullName: form.fullName,
      courseYear: Number(form.courseYear) || 0,
      email: form.email,
    });
    setPending(false);
    if (res.ok) {
      setEditing(false);
      setSaved(true);
      router.refresh();
    } else if (res.error === "validation") {
      setErrors(res.fields);
    } else {
      setFormError(res.error ?? "internal");
    }
  }

  const fieldMessage = (field: string) =>
    errors[field] ? auth(`errors.${field}_${errors[field]}` as never) : undefined;

  return (
    <section aria-labelledby="profile-heading" className="rounded-lg border p-6">
      <div className="flex items-center gap-4">
        <Avatar size="lg" className="size-14">
          <AvatarFallback className="bg-primary text-lg font-bold text-primary-foreground">
            {initials(profile.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 id="profile-heading" className="truncate text-xl font-bold">
            {profile.fullName}
          </h2>
          <p className="text-muted-foreground">@{profile.login}</p>
        </div>
      </div>

      {editing ? (
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          {formError ? (
            <p role="alert" className="rounded-md border border-destructive/40 bg-tint px-3 py-2 text-sm text-destructive">
              {auth(`errors.${formError}` as never)}
            </p>
          ) : null}

          <Field id="profile-name" label={auth("fullNameLabel")} error={fieldMessage("fullName")}>
            <Input
              id="profile-name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              maxLength={100}
              required
              aria-invalid={errors.fullName ? true : undefined}
              aria-describedby={errors.fullName ? "profile-name-error" : undefined}
              className={inputClass}
            />
          </Field>

          <Field id="profile-year" label={auth("courseYearLabel")} error={fieldMessage("courseYear")}>
            <select
              id="profile-year"
              value={form.courseYear}
              onChange={(e) => setForm({ ...form, courseYear: e.target.value })}
              className="h-11 w-full rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">{auth("courseYearPlaceholder")}</option>
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {auth("courseYearOption", { year })}
                </option>
              ))}
            </select>
          </Field>

          <Field id="profile-email" label={auth("emailLabel")} error={fieldMessage("email")}>
            <Input
              id="profile-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={254}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "profile-email-error" : undefined}
              className={inputClass}
            />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {t("save")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">{t("fullName")}</dt>
            <dd className="font-semibold">{profile.fullName}</dd>
            <dt className="text-muted-foreground">{t("login")}</dt>
            <dd className="font-semibold">{profile.login}</dd>
            <dt className="text-muted-foreground">{t("courseYear")}</dt>
            <dd className="font-semibold">
              {profile.courseYear ? auth("courseYearOption", { year: profile.courseYear }) : t("notSet")}
            </dd>
            <dt className="text-muted-foreground">{t("email")}</dt>
            <dd className="font-semibold break-all">{profile.email ?? t("notSet")}</dd>
            <dt className="text-muted-foreground">{t("memberSince")}</dt>
            <dd className="font-semibold">{memberSince}</dd>
          </dl>

          {saved ? (
            <p role="status" className="mt-4 text-sm text-emerald-700">
              {t("saved")}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSaved(false);
                setEditing(true);
              }}
            >
              <PencilIcon data-icon="inline-start" />
              {t("edit")}
            </Button>
            <LogoutButton />
          </div>
        </>
      )}
    </section>
  );
}
