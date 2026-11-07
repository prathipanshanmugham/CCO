#!/usr/bin/env bash
# Restore a database dump: bash deploy/restore.sh backups/db-YYYYMMDD-HHMM.sql.gz
set -euo pipefail
cd "$(dirname "$0")"
[ -f "${1:-}" ] || { echo "usage: restore.sh <db-dump.sql.gz>"; exit 1; }
read -r -p "This REPLACES the live database with $1. Type RESTORE to continue: " ok; [ "$ok" = RESTORE ] || exit 1
docker compose stop app
docker compose exec -T db psql -U clelia -d postgres -c "DROP DATABASE clelia;" -c "CREATE DATABASE clelia OWNER clelia;"
gunzip -c "$1" | docker compose exec -T db psql -U clelia -d clelia
docker compose start app
echo "✔ Restored."
