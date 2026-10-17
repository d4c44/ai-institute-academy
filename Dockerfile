# syntax=docker/dockerfile:1
# Next.js frontend, standalone output. The Go API has its own image (backend/Dockerfile).

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
# next.config.ts bakes the /api/v1 rewrite target into the build, so the API address has to be known here
# (it is also set at run time for server-side calls). The default matches docker-compose.
ARG API_URL=http://api:8080
ENV API_URL=$API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The build never calls the API (catalog data streams at request time).
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
# Keep HOSTNAME=0.0.0.0. Binding to one specific IP makes Next treat the locale rewrite
# (/ → /kk) as an external proxy, and "/" ends up in a redirect loop.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
