#!/usr/bin/env bash
# Database backup: a gzipped pg_dump in /opt/ai-academy/backups, the last 14 are kept.
# Run it by hand, or daily from cron (docs/DEPLOY.md):
#   0 3 * * * /opt/ai-academy/backup.sh >> /opt/ai-academy/backups/backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")"
set -a; . ./.env; set +a

mkdir -p backups
out="backups/ai-academy-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-ai_institute}" "${POSTGRES_DB:-ai_institute}" | gzip > "$out"

# A dump this small means something went wrong (an empty database still compresses to a few KB).
if [ "$(stat -c %s "$out")" -lt 1024 ]; then
  echo "backup $out looks empty" >&2
  rm -f "$out"
  exit 1
fi
ls -1t backups/ai-academy-*.sql.gz | tail -n +15 | xargs -r rm --
echo "$(date -Is) wrote $out ($(du -h "$out" | cut -f1))"
