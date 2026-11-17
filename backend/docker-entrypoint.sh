#!/bin/sh
set -e
DATA_DIR=/pb/pb_data

# Create/refresh the dashboard superuser from Railway variables (optional)
if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
  /pb/pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir="$DATA_DIR" --migrationsDir=/pb/pb_migrations
fi

exec /pb/pocketbase serve \
  --http="0.0.0.0:${PORT:-8080}" \
  --dir="$DATA_DIR" \
  --migrationsDir=/pb/pb_migrations
