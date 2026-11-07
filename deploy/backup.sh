#!/usr/bin/env bash
# Dumps the database and archives uploaded files into deploy/backups/. Keeps 14 days.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
stamp=$(date +%Y%m%d-%H%M)
docker compose exec -T db pg_dump -U clelia -d clelia --no-owner | gzip > "backups/db-${stamp}.sql.gz"
docker run --rm -v "$(basename "$(pwd)")_storage":/data:ro -v "$(pwd)/backups":/out alpine tar czf "/out/storage-${stamp}.tgz" -C /data . 2>/dev/null \
  || docker compose cp app:/data/storage "backups/storage-${stamp}" >/dev/null
find backups -type f -mtime +14 -delete
echo "$(date -Is) backup ok ${stamp}"
