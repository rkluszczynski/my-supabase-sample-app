#!/usr/bin/env sh
set -eu

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

CRON_LOG="${CRON_LOG:-/var/log/legal-acts-ingest.log}"

mkdir -p /var/log
touch "$CRON_LOG"

cat > /etc/crontabs/root <<EOF
CRON_TZ=CET
17 4,10,16,22 * * * /app/backend/run_ingest.sh >> $CRON_LOG 2>&1
EOF

crond

exec python3 /app/frontend_server.py
