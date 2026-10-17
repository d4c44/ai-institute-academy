#!/usr/bin/env bash
# Runs once when the Codespace is created: installs dependencies, prepares the database and builds.
set -euo pipefail
cd "$(dirname "$0")/.."

# The site's /api/v1 rewrite points at the Go API; the target is fixed at build time.
printf 'API_URL="http://localhost:8080"\nAPP_URL="http://localhost:3000"\n' > .env

echo "== waiting for PostgreSQL"
for _ in $(seq 1 60); do
  (echo > /dev/tcp/db/5432) 2>/dev/null && break
  sleep 2
done

export DATABASE_URL="postgres://ai_institute:ai_institute@db:5432/ai_institute?sslmode=disable"

echo "== backend: migrate, seed, build"
(
  cd backend
  go run ./cmd/api migrate
  go run ./cmd/seed
  go build -o bin/api ./cmd/api
)

echo "== frontend: install and build"
npm ci
NEXT_TELEMETRY_DISABLED=1 npm run build

echo "== done"
