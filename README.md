# Clelia & Co. — Design Studio platform (v2)

Customers describe a piece of jewellery, see it in 3D and AR at real size, and request a quote. Staff price it from the 3D metal weight, a manager approves, the customer pays an advance through Razorpay, and the piece goes to 3D printing and casting from the exported files. Includes the **Scorpling** sub-brand for iced-out jewellery at `/scorpling`.

```
apps/web        React 18 + Vite — customer studio, tracking & payment page, staff console
apps/api        Node 22 + Express + PostgreSQL — auth, roles, quotes, pricing, payments, AI image proxy
packages/engine Procedural jewellery geometry in mm, volume→weight, STL/3MF/OBJ/GLB exporters
deploy          Docker Compose (Caddy HTTPS + app + Postgres), deploy.sh, backups, DEPLOY.md
```

## Run locally

```bash
npm install
# PostgreSQL 14+ running locally, then:
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL, APP_SECRET, ADMIN_PASSWORD
npm run dev                               # API on :4000, web on :5173 (proxies /api)
npm test                                  # API end-to-end tests (uses the DATABASE_URL in apps/api/.env)
```

First start runs the SQL migrations, seeds default settings and creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. `npm run db:seed -w apps/api` adds demo staff/manager accounts (password `clelia123`) for a staging server.

## Deploy

See **[deploy/DEPLOY.md](deploy/DEPLOY.md)** — Hostinger VPS, one command.

## How the pieces fit

**Customer studio** (`/`, `/scorpling`): piece → description + metal + stone + reference photos → 3 generated 3D options with live sliders, weight, AR and optional AI concept images → contact & address (PIN auto-fill) → review → request sent. Print files (STL, 3MF, OBJ, GLB) and a preview are exported in the browser and uploaded with the request.

**Tracking** (`/track/:ref?t=token`): status timeline, itemised quote once approved, accept / decline, pay advance or full via Razorpay, pay balance later.

**Staff console** (`/staff`):
- *Staff* — pick up requests, price from the 3D weight (rates default from settings), add stones, send for approval, update production, notes.
- *Manager* — everything above plus approve / send back (never their own pricing), assign work, record cash/UPI payments, view AI usage.
- *Admin* — users & roles, pricing & content, AI provider keys (OpenRouter / OpenAI / Gemini; encrypted at rest; test button; monthly budget), activity log.

**Quote statuses**: NEW → IN_REVIEW → PENDING_APPROVAL → (CHANGES_REQUESTED →) QUOTED → ACCEPTED → IN_PRODUCTION → READY → SHIPPED → COMPLETED, plus DECLINED / CANCELLED. Transitions and who may trigger them live in `apps/api/src/services/quotes.js` and `lib/auth.js`.

## API (summary)

| Area | Endpoints |
|---|---|
| Public | `GET /api/content`, `GET /api/pincode/:pin`, `POST/PATCH/GET /api/designs[/:id]`, `POST /api/designs/:id/references`, `POST /api/designs/:id/model`, `POST /api/designs/:id/images`, `POST /api/quotes` |
| Tracking | `GET /api/track/:ref?t=`, `POST …/accept`, `POST …/decline`, `POST …/pay`, `POST …/pay/verify` |
| Payments | `POST /api/payments/razorpay/webhook` |
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password` |
| Staff | `GET /api/staff/dashboard`, `GET /api/staff/quotes`, `GET /api/staff/quotes/:id`, `POST …/price[?preview=1]`, `POST …/action`, `POST …/notes`, `POST …/assign`, `POST …/manual-payment`, `GET /api/staff/files/*` |
| Admin | `GET/POST/PATCH /api/admin/users`, `GET /api/admin/settings`, `PUT /api/admin/settings/:key`, `GET /api/admin/ai`, `PUT /api/admin/ai/:provider/key`, `PATCH/DELETE /api/admin/ai/:provider`, `POST /api/admin/ai/:provider/test`, `GET /api/admin/audit` |

Errors are `{ error, details? }`. Staff sessions are httpOnly cookies (12 h). Customers authenticate per request with the tracking token or their phone number.

## Security notes

- AI provider keys: AES-256-GCM, key derived from `APP_SECRET`; only the last 4 characters are ever returned.
- Razorpay: checkout signature verified server-side; webhook HMAC verified on the raw body; events are idempotent.
- Rate limits on login, design creation, quote requests and AI images per IP; Helmet headers; CORS locked to `PUBLIC_URL`.
- Model files are downloadable by signed-in staff only; design images use unguessable paths.
