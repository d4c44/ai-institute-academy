import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Locale negotiation: Accept-Language / NEXT_LOCALE cookie → redirect or rewrite to /[locale]/...
// Auth redirects are added here in step 3, but only as a fast path: every page and Server Action
// still checks the session itself.
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next.js internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
