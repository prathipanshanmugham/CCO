# Deploying Clelia & Co. on a Hostinger VPS

Everything runs in Docker on one server: **Caddy** (automatic HTTPS) → **app** (API + web) → **PostgreSQL**. Uploaded photos, AI images and 3D print files live in a Docker volume; nightly backups go to `deploy/backups/`.

## Which plan

| Plan | Fits |
|---|---|
| **KVM 1** (1 vCPU, 4 GB) | Fine to launch. Handles the studio, quotes and payments comfortably. |
| **KVM 2** (2 vCPU, 8 GB) | Recommended once there are a few staff using it daily and AI images are on. Faster builds and headroom for backups. |

Pick **Ubuntu 24.04** as the OS. No control panel is needed.

## 1. Point the domain

In your DNS (Hostinger hPanel → Domains → DNS), add an **A record**:

```
design.cleliaandco.com  →  <your VPS IP>
```

Wait until `ping design.cleliaandco.com` shows the VPS IP (usually 5–30 minutes). HTTPS cannot be issued until this resolves.

## 2. Get the code onto the server

SSH in as root (Hostinger shows the IP and password under VPS → Overview):

```bash
ssh root@<your VPS IP>
apt-get update && apt-get install -y git unzip
```

Either clone your repository:

```bash
git clone <your repo url> /opt/clelia && cd /opt/clelia
```

or upload `clelia-platform.zip` with `scp` and unzip it to `/opt/clelia`.

## 3. First run

```bash
cd /opt/clelia
bash deploy/deploy.sh
```

The first run installs Docker, creates `deploy/.env` with generated secrets and stops. Open it:

```bash
nano deploy/.env
```

Set at least:

- `DOMAIN=design.cleliaandco.com`
- `ADMIN_PASSWORD=` a strong password for the first admin login
- `ACME_EMAIL=` your email (certificate expiry notices)

Save, then run the script again:

```bash
bash deploy/deploy.sh
```

It builds the image (3–6 minutes the first time), starts the three containers, waits for the health check and installs the nightly backup. Open `https://design.cleliaandco.com`. The staff console is at `/staff/login`.

## 4. Sign in and set up

1. **Change the admin password** (you are asked on first sign-in).
2. **Users & roles** → add your staff and managers.
3. **Pricing & content** → today's metal rates, stone prices, charges, support phone.
4. **AI images** → paste your OpenRouter (or OpenAI / Gemini) key, pick a model, click **Test image**. Set a monthly budget if you like. The key is encrypted with `APP_SECRET` and never leaves the server.

## 5. Razorpay

1. Razorpay Dashboard → **Account & Settings → API keys** → generate **test** keys first.
2. Put them in `deploy/.env` as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
3. Dashboard → **Webhooks** → Add: URL `https://design.cleliaandco.com/api/payments/razorpay/webhook`, secret of your choice (put it in `RAZORPAY_WEBHOOK_SECRET`), events `payment.captured`, `payment.failed`, `refund.processed`.
4. Apply: `docker compose -f deploy/docker-compose.yml up -d app`.
5. Run a test quote end to end with a test card, then swap to **live** keys and repeat step 4.

## Day-to-day

```bash
cd /opt/clelia/deploy
docker compose logs -f app          # live logs
docker compose ps                   # status
docker compose restart app          # restart the app only
bash backup.sh                      # backup now (also runs nightly at 02:30)
bash restore.sh backups/db-....sql.gz
```

**Update to a new version:** `git pull` (or upload the new zip over the folder), then `bash deploy/deploy.sh`. Database migrations run automatically on start.

## Embedding on the shop

Add a button on cleliaandco.com that opens the studio:

```html
<a href="https://design.cleliaandco.com" target="_blank" rel="noopener">Design your own</a>
```

For Scorpling: `https://design.cleliaandco.com/scorpling`.

## If something goes wrong

- **Site shows a Caddy error / no certificate** → DNS is not pointing at the VPS yet, or port 80/443 is blocked. `docker compose logs caddy`.
- **App unhealthy** → `docker compose logs app`. Most common: `ADMIN_PASSWORD` under 8 characters on the very first start.
- **Forgot the admin password** → `docker compose exec app node -e "import('bcryptjs').then(async b=>console.log(await b.hash('NewPass123',11)))"` then `docker compose exec db psql -U clelia -d clelia -c "UPDATE users SET password_hash='<hash>', must_change_pw=true WHERE email='admin@cleliaandco.com';"`
- **AI images stopped** → AI images page shows the last error; usually the provider key ran out of credit or the monthly budget was hit.
- **Disk filling up** → `docker system prune -f` removes old images; backups older than 14 days are deleted automatically.

Secrets (`deploy/.env`) are never committed. Keep a copy of `APP_SECRET` somewhere safe: without it, stored AI keys cannot be decrypted after a server rebuild (re-entering them in the admin page is the fix).
