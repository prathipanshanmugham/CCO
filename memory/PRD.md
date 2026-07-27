# Clelia & Co. Design Studio — Product Record

## Original problem statement
Build a self-hosted luxury jewellery co-creation platform where customers design bespoke pieces with AI, compare concepts, request quotes or pay, track orders, while staff safely operate production and manufacturing assets remain staff-only.

## User personas
- **Customer:** Creates and refines a private jewellery commission, saves designs, requests a quote and tracks an order.
- **Staff:** Manages approved orders, production stages, client updates and protected production assets.
- **Manager:** Oversees staff, pricing, audit history, content and commercial performance.

## Architecture decisions
- React frontend with responsive editorial design, React Router and Tailwind-ready global system.
- FastAPI REST API with JWT role claims, MongoDB data collections and server-enforced staff/manager permissions.
- Secure manufacturing-file endpoint remains staff/manager-only and checks confirmed payment status before availability.
- Docker Compose configuration includes frontend, backend, MongoDB, Redis, MinIO and Caddy for portable self-hosting.
- GPT Image 1 and Gemini Nano Banana appear as selectable concept models; user will provide provider credentials later.
- Quote requests are the current checkout path; Razorpay and Stripe configuration is retained for the later payment phase.

## Core requirements
- Consistent Clelia palette, supplied logo and luxury editorial hierarchy.
- Customer Design Studio with piece type, brief, references, specifications, model selection and concept selection.
- Separate customer and staff login surfaces, with TOTP input for staff.
- Staff/manager operational surfaces and strict design boundary for protected print assets.
- Mobile-first UI, tests selectors, portable operational configuration and security-aware API design.

## Implemented — 2026-07-27
- Branded public shell, hero, editorial public pages, vault, profile, orders, viewer and AR surfaces.
- Multi-step Design Studio with all jewellery types, prompt guidance, five-reference limit, material inputs, selectable GPT Image 1/Gemini Nano Banana model cards, concepts, quote and 3D actions.
- Customer login, signup and staff TOTP login interface; staff order queue, metrics and restricted-production panel.
- FastAPI foundations for registration/login, staff TOTP verification, JWT roles, designs, quotes, orders, production updates and audit logging.
- Dockerfiles, Docker Compose, Caddy security headers and environment example.
- Verified production frontend build and automated UI flow: 34/34 checks passed before follow-up polish fixes; final signup and logo state also verified.

## v2 Revision Implemented — 2026-07-27
- Reframed the customer experience as a direct-entry embedded design tool: opening the root URL enters step 1, with a focused logo/progress/account header and a minimal return/help footer.
- Added query-driven type selection (`?type=ring`), a six-step plain-language flow, first-visit guide, replayable help, example ideas, inline validation, and explicit back navigation.
- Added OpenAI streamed design guidance at `POST /api/design-guidance/stream`. The provider key is server-side only; customer descriptions and generated guidance are stored as persistent messages.
- Added Caddy `frame-ancestors` policy for the Clelia store domains, allowing safe iframe embedding without broad framing access.
- Verified direct-entry, progressive flow, live streamed design guidance, mobile overflow, logo/footer destinations, and customer/staff login surfaces. Backend integration tests: 6/6 passed.

## Viewer, mobile try-on and Manager controls — 2026-07-27
- Added a working WebGL jewellery preview with explicit canvas dimensions, studio lighting, metal swapping, reset, fullscreen, drag-to-rotate and scroll/pinch-equivalent zoom controls.
- Added a QR-code mobile handoff from the 3D stage. The code opens the selected jewellery type and metal on a mobile device, where the user can request camera access for try-on.
- Added Manager-authenticated content settings endpoints and screen for jewellery types, visible-state protection, gold rate and payment handoff mode. Public designer choices now load from the database.
- Seeded a Manager account with TOTP and documented it in `memory/test_credentials.md` for verified staff access.
- Verified 14 backend checks and full customer/Manager browser flows: streamed guidance, rendered canvas, material swap, QR dialog, Manager login and saved settings.

## Prioritized backlog
### P0
- Connect customer/staff authentication forms to API and enforce protected frontend routes.
- Persist the six-step confirmed design, honour `return_url` through signed handoff mode, and complete Manager configuration for self-contained versus ecommerce handoff.
- Add secure MinIO private-bucket client, verified payment webhooks, one-time five-minute staff print-file links and complete audit export.
- Connect image/3D providers after their credentials are supplied; run generation and 3D conversion in Redis-backed workers.
- Implement real GLB/USdz asset pipeline, interactive viewer controls and device-specific AR.
- Replace the verified parametric preview with the production GLB/Draco and USDZ pipeline when the image-to-3D provider is selected; add native Android/iOS AR launch adapters.

### P1
- PostgreSQL + versioned migrations if the deployment data layer is moved from the current MongoDB starter runtime.
- Live pricing rules, quote management, Razorpay/Stripe activation, notifications and production photo upload.
- Real 3D GLB viewer, camera AR tracking, certificates, consent/data-export flows and advanced manager controls.

### P2
- SEO sitemap/Open Graph production automation, loyalty/referrals, gold-rate alerts, gallery consent workflow, booking and reporting extensions.

## Next tasks
1. Build the Manager content/settings editor so every customer-facing type, field, prompt, feature and payment mode is database-managed.
2. Wire confirmed designs, signed ecommerce handoff and live staff order data through the current flow.
3. Complete the payment-to-manufacturing security chain and verified 3D/AR asset pipeline before any live order acceptance.
