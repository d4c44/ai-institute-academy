import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const API_URL = process.env.API_URL ?? "http://localhost:8080";
// Same rule as DEMO in src/demo/server.ts (that file is server-only, so it is repeated here).
const DEMO_MODE =
  process.env.DEMO_MODE === "1" ||
  (process.env.DEMO_MODE !== "0" && process.env.NODE_ENV !== "production" && !process.env.API_URL);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The Docker build sets NEXT_OUTPUT=standalone. Not on by default: standalone output needs
  // symlinks, which Windows only allows with Developer Mode.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  experimental: {
    // 404 for URLs outside every route (the root layout lives under [locale]).
    globalNotFound: true,
  },
  // The browser talks to the Go API through the same origin, so session cookies need no CORS.
  // beforeFiles, so it wins over the demo route handler (src/app/api/v1). In demo mode there is
  // no rewrite and that route handler answers instead. Decided at build time.
  async rewrites() {
    if (DEMO_MODE) return [];
    return { beforeFiles: [{ source: "/api/v1/:path*", destination: `${API_URL}/api/v1/:path*` }] };
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
