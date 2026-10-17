import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const API_URL = process.env.API_URL ?? "http://localhost:8080";

// STATIC_EXPORT=1 builds the GitHub Pages version (scripts/build-static.mjs): plain files, no server.
// Everything a visitor owns (account, progress, certificates) then lives in their browser (src/static).
const STATIC = process.env.STATIC_EXPORT === "1";
const BASE_PATH = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Cache Components (partial prerendering) cannot be combined with a static export.
  cacheComponents: !STATIC,
  partialPrefetching: !STATIC,
  // The Docker build sets NEXT_OUTPUT=standalone. Not on by default: standalone output needs
  // symlinks, which Windows only allows with Developer Mode.
  output: STATIC ? "export" : process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  ...(STATIC ? { basePath: BASE_PATH, trailingSlash: true, images: { unoptimized: true } } : {}),
  env: {
    NEXT_PUBLIC_STATIC: STATIC ? "1" : "",
    NEXT_PUBLIC_BASE_PATH: STATIC ? BASE_PATH : "",
  },
  experimental: {
    // 404 for URLs outside every route (the root layout lives under [locale]).
    globalNotFound: true,
  },
  // The browser talks to the Go API through the same origin, so session cookies need no CORS.
  // The target is fixed at build time (API_URL must be set when `next build` runs).
  // Not in the static export: there is no server to rewrite anything.
  ...(STATIC
    ? {}
    : {
        async rewrites() {
          return { beforeFiles: [{ source: "/api/v1/:path*", destination: `${API_URL}/api/v1/:path*` }] };
        },
      }),
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
