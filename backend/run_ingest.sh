#!/usr/bin/env bash
#
# Uruchomienie wsadowe — przeznaczone do crona.
#
# Przykładowy wpis (codziennie o 6:15):
#   15 6 * * * /ścieżka/do/backend/run_ingest.sh >> /var/log/legal-acts-ingest.log 2>&1

set -euo pipefail

cd "$(dirname "$0")"

PYTHON="${PYTHON:-.venv/bin/python}"

if [ ! -x "$PYTHON" ]; then
  echo "Brak środowiska wirtualnego. Uruchom najpierw:" >&2
  echo "  python3 -m venv .venv && .venv/bin/pip install -e ." >&2
  exit 2
fi

exec "$PYTHON" -m legal_acts_ingest --format none "$@"
