#!/usr/bin/env bash
#
# Uruchomienie wsadowe — przeznaczone do crona.
#
# Harmonogram w obrazie Docker:
#   17 4,10,16,22 * * * /app/backend/run_ingest.sh >> /var/log/legal-acts-ingest.log 2>&1

set -euo pipefail

cd "$(dirname "$0")"

if [ -n "${SUPABASE_URL:-}" ] || [ -n "${SUPABASE_SECRET_KEY:-}" ]; then
  ENV_FILE="${ENV_FILE:-.env}"
  if [ ! -f "$ENV_FILE" ]; then
    cat >"$ENV_FILE" <<EOF
SUPABASE_URL=${SUPABASE_URL:-}
SUPABASE_SECRET_KEY=${SUPABASE_SECRET_KEY:-}
ELI_LOOKBACK_DAYS=${ELI_LOOKBACK_DAYS:-14}
ELI_PUBLISHERS=${ELI_PUBLISHERS:-DU,MP}
ELI_PAGE_LIMIT=${ELI_PAGE_LIMIT:-50}
ELI_API_BASE=${ELI_API_BASE:-https://api.sejm.gov.pl/eli}
ELI_TIMEOUT=${ELI_TIMEOUT:-30}
EOF
  fi
fi

PYTHON="${PYTHON:-python3}"

if [ ! -x "$PYTHON" ]; then
  echo "Nie znaleziono interpretera Python pod ścieżką: $PYTHON" >&2
  exit 2
fi

exec "$PYTHON" -m legal_acts_ingest --env-file "${ENV_FILE:-.env}" --format none "$@"
