# QAVRIL LABS ERP web app

The web app and product launcher for the ERP. Owned by the frontend lane (Antigravity).

- Builds screens from the contracts in the `home` repository (`contracts/*.openapi.yaml`). It never calls a database and never imports backend code.
- Stack and tooling are chosen by the frontend lane. The first commit here is documentation only.
- The launcher shows the products enabled for the tenant (`GET /v1/platform/entitlements`).

See `docs/product-platform-decisions.md` in the `home` repository for the agreed decisions.
