#!/bin/sh
set -eu

mkdir -p /var/lib/clamav "$HOME"
chown -R nobody:nogroup "$HOME"

# A missing or stale database never produces a clean release. Refresh before
# the API starts, then refresh periodically while the container is running.
freshclam --datadir=/var/lib/clamav --stdout || true
(
  while true; do
    sleep "${FRESHCLAM_INTERVAL_SECONDS:-21600}"
    freshclam --datadir=/var/lib/clamav --stdout || true
  done
) &

exec gosu nobody:nogroup uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8080}" \
  --workers "${WEB_CONCURRENCY:-1}" \
  --proxy-headers \
  --forwarded-allow-ips='*'
