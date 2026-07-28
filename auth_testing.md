# Authentication verification

1. Confirm seeded Manager and Staff accounts can complete staff login with TOTP.
2. Confirm a Staff token receives `403` from every `/api/manager/*` endpoint.
3. Confirm a Customer token cannot request `/api/staff/*` endpoints or manufacturing files.
4. Confirm all protected endpoints reject missing and invalid bearer tokens with `401`.