import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const API_URL = process.env.API_URL ?? "http://localhost:8080";

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
  // The target is fixed at build time (API_URL must be set when `next build` runs).
  async rewrites() {
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
