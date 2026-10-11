#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  . ".env"
  set +a
fi

PROJECT_REF="${1:-}"

if [ -z "${PROJECT_REF}" ] && [ -n "${SUPABASE_URL:-}" ]; then
  PROJECT_REF="$(printf '%s' "${SUPABASE_URL}" | sed -E 's#^https://([^.]+)\\.supabase\\.co/?$#\\1#')"
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Brak Supabase CLI. Zainstaluj narzędzie 'supabase' i zaloguj się poleceniem 'supabase login'." >&2
  exit 2
fi

if [ -z "${PROJECT_REF}" ]; then
  echo "Podaj project ref jako pierwszy argument albo ustaw poprawne SUPABASE_URL w .env." >&2
  exit 2
fi

echo "Linkowanie projektu Supabase: ${PROJECT_REF}"
supabase link --project-ref "${PROJECT_REF}"

echo "Wypychanie migracji z supabase/migrations/"
supabase db push

echo "Gotowe. Schemat z backend/supabase/migrations/ został zastosowany."
