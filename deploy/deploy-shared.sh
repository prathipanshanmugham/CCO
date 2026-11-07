#!/usr/bin/env bash
# Deploy next to existing sites: no Caddy, app on 127.0.0.1:${APP_PORT:-4010}, Nginx site + certbot.
#   sudo bash deploy/deploy-shared.sh
set -euo pipefail
cd "$(dirname "$0")"
command -v docker >/dev/null 2>&1 || { echo "▸ Installing Docker…"; curl -fsSL https://get.docker.com | sh; }

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$(openssl rand -hex 16)|" .env
  sed -i "s|^APP_SECRET=.*|APP_SECRET=$(openssl rand -base64 48 | tr -d '\n/+=')|" .env
  echo "APP_PORT=4010" >> .env
  echo "▸ Created deploy/.env. Edit it (DOMAIN, ADMIN_PASSWORD, ACME_EMAIL) and run this script again."; exit 0
fi
set -a; . ./.env; set +a
: "${DOMAIN:?DOMAIN missing}"; : "${ADMIN_PASSWORD:?ADMIN_PASSWORD missing}"
APP_PORT="${APP_PORT:-4010}"

echo "▸ Building and starting db + app on 127.0.0.1:${APP_PORT}…"
docker compose -f docker-compose.shared.yml pull db
docker compose -f docker-compose.shared.yml build --pull app
docker compose -f docker-compose.shared.yml up -d --remove-orphans
for i in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1 && { echo "✔ App healthy."; break; }
  sleep 3; [ "$i" = 30 ] && { echo "✖ App not healthy:"; docker compose -f docker-compose.shared.yml logs --tail=60 app; exit 1; }
done

if command -v nginx >/dev/null 2>&1; then
  echo "▸ Configuring Nginx site for ${DOMAIN}…"
  sed "s/design.cleliaandco.com/${DOMAIN}/g; s/4010/${APP_PORT}/g" nginx-design.conf > "/etc/nginx/sites-available/${DOMAIN}"
  ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
  nginx -t && systemctl reload nginx
  if ! command -v certbot >/dev/null 2>&1; then apt-get install -y certbot python3-certbot-nginx >/dev/null; fi
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${ACME_EMAIL:-admin@cleliaandco.com}" --redirect || echo "⚠ certbot failed (DNS not pointing here yet?). Re-run: certbot --nginx -d ${DOMAIN}"
else
  echo "⚠ Nginx not found. Point your existing web server at http://127.0.0.1:${APP_PORT} for ${DOMAIN} (see deploy/nginx-design.conf)."
fi

cat > /etc/cron.d/clelia-backup <<CRON
30 2 * * * root bash $(pwd)/backup.sh >> /var/log/clelia-backup.log 2>&1
CRON
sed -i 's/docker compose exec/docker compose -f docker-compose.shared.yml exec/; s/docker compose cp/docker compose -f docker-compose.shared.yml cp/' backup.sh 2>/dev/null || true
echo; echo "✔ Done. https://${DOMAIN}  ·  staff: https://${DOMAIN}/staff/login"
