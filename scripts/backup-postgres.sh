#!/bin/sh
set -eu
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Defina DATABASE_URL. O script não guarda senha." >&2
  exit 1
fi
out="${1:-backup.dump}"
pg_dump --format=custom --no-owner --file="$out" "$DATABASE_URL"
echo "$out"
