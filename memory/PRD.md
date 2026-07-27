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

## Prioritized backlog
### P0
- Connect customer/staff authentication forms to API and enforce protected frontend routes.
- Add secure MinIO private-bucket client, verified payment webhooks, one-time five-minute staff print-file links and complete audit export.
- Connect chosen AI providers after credentials are supplied; run generation and 3D conversion in Redis-backed workers.
- Implement persistent customer designs, quote requests, order data and staff actions across UI/API.

### P1
- PostgreSQL + versioned migrations if the deployment data layer is moved from the current MongoDB starter runtime.
- Live pricing rules, quote management, Razorpay/Stripe activation, notifications and production photo upload.
- Real 3D GLB viewer, camera AR tracking, certificates, consent/data-export flows and advanced manager controls.

### P2
- SEO sitemap/Open Graph production automation, loyalty/referrals, gold-rate alerts, gallery consent workflow, booking and reporting extensions.

## Next tasks
1. Receive AI provider and transactional-service credentials.
2. Wire API data to the current customer and staff journeys.
3. Complete the payment-to-manufacturing security chain before any live order acceptance.
