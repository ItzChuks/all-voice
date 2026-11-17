# Backend (PocketBase) — deployed on Railway

This folder is the whole backend. Railway builds it with the `Dockerfile`.

Railway settings:
- Settings → Source → **Root Directory**: `/backend`
- Variables: `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`
- Volume mounted at: `/pb/pb_data`
- Networking → Generate Domain → port `8080`

Dashboard: https://<your-domain>/_/
