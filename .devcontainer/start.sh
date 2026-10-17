#!/usr/bin/env bash
# Runs every time the Codespace starts: (re)starts the Go API and the site in the background.
# Logs: /tmp/api.log and /tmp/web.log. Open the "Site" entry in the Ports tab to see the site.
set -uo pipefail
cd "$(dirname "$0")/.."

# Public address of this Codespace's forwarded port 3000: used in certificate QR codes.
if [ -n "${CODESPACE_NAME:-}" ]; then
  APP_URL="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
else
  APP_URL="http://localhost:3000"
fi

cat > backend/.env <<EOF
DATABASE_URL=postgres://ai_institute:ai_institute@db:5432/ai_institute?sslmode=disable
APP_URL=${APP_URL}
ADDR=:8080
APP_ENV=development
EOF

pkill -f "backend/bin/api" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
sleep 1

for _ in $(seq 1 60); do
  (echo > /dev/tcp/db/5432) 2>/dev/null && break
  sleep 2
done

(cd backend && setsid nohup ./bin/api > /tmp/api.log 2>&1 < /dev/null &)

# HOSTNAME must stay 0.0.0.0: the container's own hostname makes the "/" -> "/kk" rewrite loop.
HOSTNAME=0.0.0.0 PORT=3000 setsid nohup npm start > /tmp/web.log 2>&1 < /dev/null &

echo "Site starting: ${APP_URL}"
