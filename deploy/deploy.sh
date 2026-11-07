#!/usr/bin/env bash
# One-command deploy / update for an Ubuntu 22.04/24.04 Hostinger VPS.
#   First time:  sudo bash deploy/deploy.sh
#   Update:      git pull && sudo bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "▸ Installing Docker…"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || { echo "Docker Compose plugin missing; install docker-compose-plugin"; exit 1; }

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$(openssl rand -hex 16)|" .env
  sed -i "s|^APP_SECRET=.*|APP_SECRET=$(openssl rand -base64 48 | tr -d '\n/+=')|" .env
  echo "▸ Created deploy/.env with generated secrets."
  echo "  Edit it now: set DOMAIN, ADMIN_PASSWORD and (later) the Razorpay keys. Then run this script again."
  exit 0
fi

set -a; . ./.env; set +a
: "${DOMAIN:?DOMAIN missing in .env}"; : "${ADMIN_PASSWORD:?ADMIN_PASSWORD missing in .env}"

if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null || true; ufw allow 80/tcp >/dev/null || true; ufw allow 443 >/dev/null || true
  ufw --force enable >/dev/null || true
fi

echo "▸ Building and starting containers (first build takes a few minutes)…"
docker compose pull db caddy
docker compose build --pull app
docker compose up -d --remove-orphans

echo "▸ Waiting for the app…"
for i in $(seq 1 30); do
  if docker compose exec -T app node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "✔ App is healthy."; break
  fi
  sleep 3
  [ "$i" = 30 ] && { echo "✖ App did not become healthy. Logs:"; docker compose logs --tail=80 app; exit 1; }
done

# Nightly database + files backup at 02:30, keep 14 days
cat > /etc/cron.d/clelia-backup <<CRON
30 2 * * * root bash $(pwd)/backup.sh >> /var/log/clelia-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/clelia-backup

echo
echo "✔ Deployed. Open https://${DOMAIN}  (HTTPS certificate is issued automatically on first visit; allow a minute)."
echo "  Staff console: https://${DOMAIN}/staff/login  — sign in as ${ADMIN_EMAIL:-admin@cleliaandco.com} and change the password."
echo "  Logs: docker compose -f $(pwd)/docker-compose.yml logs -f app"
