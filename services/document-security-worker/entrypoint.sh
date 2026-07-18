#!/bin/sh
set -eu

mkdir -p /var/lib/clamav "$HOME"

# A stale scanner is not treated as clean. Refresh at startup; the application
# reports manual-review/error if no usable signatures are available.
freshclam --datadir=/var/lib/clamav --stdout || true

exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8080}" \
  --workers "${WEB_CONCURRENCY:-1}" \
  --proxy-headers \
  --forwarded-allow-ips='*'
