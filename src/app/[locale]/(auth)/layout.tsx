import { AuthShell } from "@/components/auth/auth-shell";

// The blue panel and the top bar live here, so they stay put when navigating between sign-in and
// sign-up; only the form (see template.tsx) transitions.
export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return <AuthShell>{children}</AuthShell>;
}