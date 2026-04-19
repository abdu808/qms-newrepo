#!/bin/sh
set -e

echo "[startup] Waiting for database to be ready..."
MAX_RETRIES=30
i=0
until npx prisma db push --accept-data-loss; do
  i=$((i + 1))
  if [ $i -ge $MAX_RETRIES ]; then
    echo "[startup] Database unavailable after $MAX_RETRIES attempts. Exiting."
    exit 1
  fi
  echo "[startup] Attempt $i/$MAX_RETRIES failed. Retrying in 5s..."
  sleep 5
done

echo "[startup] Running seed check..."
node src/seed-if-empty.js

echo "[startup] Starting server..."
exec node src/server.js
